import { SagaTimeoutError, SagaAbortError } from './errors';

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
 * Прерывает выполнение Promise, если срабатывает AbortSignal.
 */
export async function withAbortSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new SagaAbortError();

  let onAbort: () => void;

  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => reject(new SagaAbortError());
    signal.addEventListener('abort', onAbort);
  });

  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    signal.removeEventListener('abort', onAbort!);
  }
}

/**
 * Выполняет функцию с повторными попытками.
 */
export async function withRetry<T>(
  action: () => Promise<T>,
  retries: number,
  retryDelay: number | ((attempt: number) => number)
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delayMs = typeof retryDelay === 'function' ? retryDelay(attempt + 1) : retryDelay;
        if (delayMs > 0) await delay(delayMs);
      }
    }
  }

  throw lastError;
}