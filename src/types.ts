/**
 * Функция выполнения шага.
 */
export type ActionFn<Ctx, Res> = (ctx: Ctx) => Promise<Res> | Res;

/**
 * Функция компенсации шага.
 */
export type CompensationFn<Ctx, Res> = (ctx: Ctx, result: Res | undefined) => Promise<void> | void;

/**
 * Настройки выполнения шага.
 */
export interface StepOptions<Ctx = any, Res = any> {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  compensationRetries?: number;
  compensationRetryDelay?: number;
  fallback?: ActionFn<Ctx, Res>;
}

/**
 * Настройки запуска саги.
 */
export interface SagaExecutionOptions {
  signal?: AbortSignal;
}

/**
 * Описание шага саги.
 */
export interface SagaStep<Ctx = any, Res = any> {
  name: string;
  action: ActionFn<Ctx, Res>;
  compensation?: CompensationFn<Ctx, Res>;
  options?: StepOptions<Ctx, Res>;
  condition?: (ctx: Ctx) => boolean | Promise<boolean>;
}

/**
 * Описание группы параллельных шагов.
 */
export interface ParallelSagaStep<Ctx = any> {
  parallel: true;
  name: string;
  steps: SagaStep<Ctx, any>[];
}

/**
 * Элемент саги: одиночный шаг или параллельная группа.
 */
export type SagaItem<Ctx = any> = SagaStep<Ctx, any> | ParallelSagaStep<Ctx>;

/**
 * Хуки жизненного цикла саги.
 */
export interface SagaHooks<Ctx> {
  onStart?: (ctx: Ctx) => void | Promise<void>;
  onStepSuccess?: (stepName: string, result: any, ctx: Ctx) => void | Promise<void>;
  onStepFailed?: (stepName: string, error: unknown, ctx: Ctx) => void | Promise<void>;
  onCompensationSuccess?: (stepName: string, ctx: Ctx) => void | Promise<void>;
  onCompensationFailed?: (stepName: string, error: unknown, ctx: Ctx) => void | Promise<void>;
  onSuccess?: (ctx: Ctx) => void | Promise<void>;
  onFailure?: (error: unknown, ctx: Ctx) => void | Promise<void>;
}

/**
 * Выполненный шаг.
 */
export interface ExecutedStep<Ctx> {
  step: SagaStep<Ctx, any>;
  result: any;
}

/**
 * Функция передачи управления в цепочке middleware.
 */
export type NextFn<Ctx> = () => Promise<ExecutedStep<Ctx> | null>;

/**
 * Middleware для перехвата выполнения шага.
 */
export type SagaMiddleware<Ctx> = (
  step: SagaStep<Ctx, any>,
  context: Ctx,
  next: NextFn<Ctx>
) => Promise<ExecutedStep<Ctx> | null>;