import { SagaMiddleware } from '../types';

/**
 * Создает middleware для получения снимков состояния (state snapshots) до и после выполнения шага.
 * 
 * @param onSnapshot Функция-обработчик глубоких копий состояния.
 */
export function createStateSnapshotMiddleware<Ctx>(
  onSnapshot: (stepName: string, stateBefore: Ctx, stateAfter: Ctx) => void | Promise<void>
): SagaMiddleware<Ctx> {
  const clone = (obj: any) => {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  };

  return async (step, context, next) => {
    const stateBefore = clone(context);
    
    const result = await next();
    
    const stateAfter = clone(context);
    
    await onSnapshot(step.name, stateBefore, stateAfter);
    
    return result;
  };
}