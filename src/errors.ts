/**
 * Базовый класс ошибки саги.
 */
export class SagaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Ошибка таймаута выполнения шага.
 */
export class SagaTimeoutError extends SagaError {
  constructor(stepName: string, timeout: number) {
    super(`Step "${stepName}" exceeded timeout of ${timeout}ms.`);
  }
}

/**
 * Ошибка выполнения саги.
 */
export class SagaExecutionError extends SagaError {
  public readonly stepName: string;
  public readonly originalError: unknown;

  constructor(message: string, stepName: string, originalError: unknown) {
    super(message);
    this.stepName = stepName;
    this.originalError = originalError;
  }
}

/**
 * Ошибка, возникающая при сбое в процессе компенсации.
 */
export class SagaCompensationError extends SagaError {
  public readonly errors: Array<{ stepName: string; error: unknown }>;

  constructor(message: string, errors: Array<{ stepName: string; error: unknown }>) {
    const details = errors.map((e) => `[${e.stepName}]: ${String(e.error)}`).join('; ');
    super(`${message} Details: ${details}`);
    this.errors = errors;
  }
}