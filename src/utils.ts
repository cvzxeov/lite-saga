import { SagaTimeoutError } from './errors';

/**
 * Задержка выполнения (sleep).
 */
export const delay = (ms: number): Promise<void> => 
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Оборачивает Promise в таймаут.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stepName: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new SagaTimeoutError(stepName, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Выполняет функцию с повторными попытками.
 */
export async function withRetry<T>(
  action: () => Promise<T>,
  retries: number,
  retryDelay: number
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        if (retryDelay > 0) await delay(retryDelay);
      }
    }
  }

  throw lastError;
}