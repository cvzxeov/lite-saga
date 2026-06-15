import { ActionFn, CompensationFn, SagaHooks, SagaStep, StepOptions, SagaItem, ParallelSagaStep, SagaMiddleware } from './types';
import { SagaExecution } from './SagaExecution';

/**
 * Builder для конструирования саги.
 * 
 * @template Ctx Тип контекста саги.
 */
export class SagaBuilder<Ctx extends Record<string, any> = {}> {
  private steps: SagaItem<Ctx>[] = [];
  private hooks: SagaHooks<Ctx> = {};
  private middlewares: SagaMiddleware<Ctx>[] = [];

  /**
   * Добавляет шаг в сагу.
   * 
   * @param name Название шага
   * @param action Функция выполнения
   * @param compensation Функция компенсации (отката)
   * @param options Настройки выполнения (ретраи, таймауты)
   */
  public step<Res>(
    name: string,
    action: ActionFn<Ctx, Res>,
    compensation?: CompensationFn<Ctx, Res>,
    options?: StepOptions<Ctx, Res>
  ): this {
    this.steps.push({ name, action, compensation, options });
    return this;
  }

  /**
   * Добавляет шаг, который выполняется только при истинности условия.
   */
  public stepIf<Res>(
    condition: (ctx: Ctx) => boolean | Promise<boolean>,
    name: string,
    action: ActionFn<Ctx, Res>,
    compensation?: CompensationFn<Ctx, Res>,
    options?: StepOptions<Ctx, Res>
  ): this {
    this.steps.push({ name, action, compensation, options, condition });
    return this;
  }

  /**
   * Добавляет группу параллельных шагов.
   * 
   * @param name Название группы
   * @param steps Массив шагов для параллельного выполнения
   */
  public parallel(name: string, steps: SagaStep<Ctx, any>[]): this {
    this.steps.push({ parallel: true, name, steps });
    return this;
  }

  /**
   * Интегрирует вложенную сагу как отдельный шаг.
   * 
   * @param name Название шага
   * @param subSaga Экземпляр SagaExecution
   * @param options Настройки выполнения
   */
  public addSubSaga(name: string, subSaga: SagaExecution<Ctx>, options?: StepOptions<Ctx, any>): this {
    return this.step(
      name,
      async (ctx) => {
        const { context: updatedContext, history } = await subSaga.executeWithHistory(ctx);
        Object.assign(ctx, updatedContext);
        return history;
      },
      async (ctx, history) => {
        if (history) {
          await subSaga.rollback(history, ctx);
        }
      },
      options
    );
  }

  /**
   * Регистрирует хуки жизненного цикла саги.
   */
  public withHooks(hooks: SagaHooks<Ctx>): this {
    this.hooks = { ...this.hooks, ...hooks };
    return this;
  }

  /**
   * Добавляет middleware для перехвата выполнения шагов.
   */
  public use(middleware: SagaMiddleware<Ctx>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Возвращает список зарегистрированных шагов.
   */
  public getSteps(): ReadonlyArray<SagaItem<Ctx>> {
    return this.steps;
  }

  /**
   * Создает экземпляр SagaExecution.
   */
  public build(): SagaExecution<Ctx> {
    if (this.steps.length === 0) {
      throw new Error('SagaBuilder: Cannot build a saga without steps.');
    }
    return new SagaExecution<Ctx>(this.steps, this.hooks, this.middlewares);
  }
}