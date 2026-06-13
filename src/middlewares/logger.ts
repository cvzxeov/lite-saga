import { SagaMiddleware } from '../types';

/**
 * Middleware для логирования выполнения шагов саги в консоль.
 */
export const loggerMiddleware: SagaMiddleware<any> = async (step, context, next) => {
  console.log(`[Saga Logger] ⏳ Начало шага: "${step.name}"`);
  const start = Date.now();
  
  try {
    const result = await next();
    const duration = Date.now() - start;
    console.log(`[Saga Logger] ✅ Шаг завершен: "${step.name}" (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[Saga Logger] ❌ Ошибка в шаге: "${step.name}" (${duration}ms)`);
    throw error;
  }
};