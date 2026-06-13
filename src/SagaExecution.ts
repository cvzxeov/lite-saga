import { SagaHooks, SagaStep, ExecutedStep, SagaItem, SagaMiddleware } from './types';
import { SagaExecutionError, SagaCompensationError } from './errors';
import { withRetry, withTimeout } from './utils';

/**
 * Движок выполнения саги. Управляет последовательностью шагов, контекстом, таймаутами, повторными попытками и откатами.
 */
export class SagaExecution<Ctx extends Record<string, any>> {
  constructor(
    private readonly steps: ReadonlyArray<SagaItem<Ctx>>,
    private readonly hooks: SagaHooks<Ctx>,
    private readonly middlewares: ReadonlyArray<SagaMiddleware<Ctx>> = []
  ) {}

  /**
   * Выполняет сагу.
   * 
   * @param initialContext Начальный контекст
   * @returns Итоговый контекст
   */
  public async execute(initialContext: Partial<Ctx> = {}): Promise<Ctx> {
    const { context } = await this.executeWithHistory(initialContext);
    return context;
  }

  /**
   * Выполняет сагу и возвращает контекст вместе с историей шагов.
   */
  public async executeWithHistory(initialContext: Partial<Ctx> = {}): Promise<{ context: Ctx; history: ExecutedStep<Ctx>[] }> {
    const executedSteps: ExecutedStep<Ctx>[] = [];
    const context: Ctx = { ...initialContext } as Ctx;

    await this.hooks.onStart?.(context);

    for (const step of this.steps) {
      if ('parallel' in step && step.parallel) {
        await this.executeParallelGroup(step.name, step.steps, executedSteps, context);
      } else {
        await this.executeSequentialStep(step as SagaStep<Ctx, any>, executedSteps, context);
      }
    }

    await this.hooks.onSuccess?.(context);
    return { context, history: executedSteps };
  }

  private async executeSequentialStep(step: SagaStep<Ctx, any>, executedSteps: ExecutedStep<Ctx>[], context: Ctx): Promise<void> {
    try {
      const res = await this.runSingleStep(step, context);
      if (res) executedSteps.push(res);
    } catch (error) {
      await this.hooks.onStepFailed?.(step.name, error, context);
      await this.compensate(executedSteps, context);
      const finalError = new SagaExecutionError(
        `Saga execution failed at step "${step.name}". Rollback completed.`,
        step.name,
        error
      );
      await this.hooks.onFailure?.(finalError, context);
      throw finalError;
    }
  }

  private async executeParallelGroup(groupName: string, steps: SagaStep<Ctx, any>[], executedSteps: ExecutedStep<Ctx>[], context: Ctx): Promise<void> {
    const results = await Promise.allSettled(
      steps.map(async (step) => {
        try {
          return await this.runSingleStep(step, context);
        } catch (error) {
          await this.hooks.onStepFailed?.(step.name, error, context);
          throw error;
        }
      })
    );

    let hasError = false;
    let firstError: unknown;

    for (const res of results) {
      if (res.status === 'fulfilled') {
        if (res.value) executedSteps.push(res.value);
      } else {
        hasError = true;
        if (!firstError) firstError = res.reason;
      }
    }

    if (hasError) {
      await this.compensate(executedSteps, context);
      const finalError = new SagaExecutionError(
        `Saga execution failed at parallel group "${groupName}". Rollback completed.`,
        groupName,
        firstError
      );
      await this.hooks.onFailure?.(finalError, context);
      throw finalError;
    }
  }

  private async runSingleStep(step: SagaStep<Ctx, any>, context: Ctx): Promise<ExecutedStep<Ctx> | null> {
    let index = -1;

    const dispatch = async (i: number): Promise<ExecutedStep<Ctx> | null> => {
      if (i <= index) throw new Error('next() called multiple times in middleware');
      index = i;

      if (i < this.middlewares.length) {
        return this.middlewares[i](step, context, () => dispatch(i + 1));
      }

      return this.executeStepAction(step, context);
    };

    return dispatch(0);
  }

  private async executeStepAction(step: SagaStep<Ctx, any>, context: Ctx): Promise<ExecutedStep<Ctx> | null> {
    if (step.condition) {
      const shouldExecute = await Promise.resolve(step.condition(context));
      if (!shouldExecute) return null;
    }

    const { retries = 0, retryDelay = 0, timeout } = step.options || {};

    const result = await withRetry(async () => {
      let actionPromise = Promise.resolve().then(() => step.action(context));
      if (timeout && timeout > 0) {
        actionPromise = withTimeout(actionPromise, timeout, step.name);
      }
      return actionPromise;
    }, retries, retryDelay);

    await this.hooks.onStepSuccess?.(step.name, result, context);
    return { step, result };
  }

  /**
   * Инициирует процесс отката для переданной истории шагов.
   */
  public async rollback(executedSteps: ExecutedStep<Ctx>[], context: Ctx): Promise<void> {
    await this.compensate(executedSteps, context);
  }

  /**
   * Выполняет компенсирующие действия в обратном порядке.
   */
  private async compensate(executedSteps: ExecutedStep<Ctx>[], context: Ctx): Promise<void> {
    const compensationErrors: Array<{ stepName: string; error: unknown }> = [];

    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const { step, result } = executedSteps[i];
      
      if (!step.compensation) continue;

      try {
        await Promise.resolve().then(() => step.compensation!(context, result));
        await this.hooks.onCompensationSuccess?.(step.name, context);
      } catch (error) {
        await this.hooks.onCompensationFailed?.(step.name, error, context);
        compensationErrors.push({ stepName: step.name, error });
      }
    }

    if (compensationErrors.length > 0) {
      throw new SagaCompensationError('Critical error during saga rollback.', compensationErrors);
    }
  }
}