import { SagaMiddleware } from '../types';

/**
 * Создает middleware для получения снимков состояния (state snapshots) до и после выполнения шага.
 * 
 * @param onSnapshot Функция-обработчик глубоких копий состояния.
 */
export function createStateSnapshotMiddleware<Ctx>(
  onSnapshot: (stepName: string, stateBefore: Ctx, stateAfter: Ctx) => void | Promise<void>
): SagaMiddleware<Ctx> {
  return async (step, context, next) => {
    const stateBefore = JSON.parse(JSON.stringify(context));
    
    const result = await next();
    
    const stateAfter = JSON.parse(JSON.stringify(context));
    
    await onSnapshot(step.name, stateBefore, stateAfter);
    
    return result;
  };
}