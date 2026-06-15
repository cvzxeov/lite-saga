import { SagaMiddleware } from '../types';

/**
 * Middleware for logging saga step execution to the console.
 */
export const loggerMiddleware: SagaMiddleware<any> = async (step, context, next) => {
  console.log(`[Saga Logger] ⏳ Starting step: "${step.name}"`);
  const start = Date.now();
  
  try {
    const result = await next();
    const duration = Date.now() - start;
    console.log(`[Saga Logger] ✅ Step completed: "${step.name}" (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[Saga Logger] ❌ Step failed: "${step.name}" (${duration}ms)`);
    throw error;
  }
};