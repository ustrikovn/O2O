/**
 * BOS Aggregate Service
 * 
 * Сервис для расчёта интегральных BOS-показателей сотрудника
 * с использованием exponential decay по последним 6 встречам.
 * 
 * Формула весов:
 * - Последняя встреча: 50%
 * - -1 встреча: 25%
 * - -2 встречи: 13%
 * - -3 встречи: 6%
 * - -4 встречи: 3%
 * - -5 встреч: 1.5%
 */

import { BOSObservationEntity } from '@/entities/bos-observation/index.js';
import { 
  EmployeeBOSAggregateEntity, 
  type BOSAggregateScores 
} from '@/entities/bos-aggregate/index.js';
import { 
  BOS_BEHAVIOR_KEYS, 
  type BOSBehaviorKey,
  type BOSObservation 
} from '@/features/assistant/agents/bos-types.js';

/**
 * Веса для exponential decay (от последней встречи к более старым)
 * Сумма: 0.50 + 0.25 + 0.13 + 0.06 + 0.03 + 0.015 = 0.985
 */
const DECAY_WEIGHTS = [0.50, 0.25, 0.13, 0.06, 0.03, 0.015];

/**
 * Максимальное количество встреч для расчёта
 */
const MAX_MEETINGS = 6;

export class BOSAggregateService {
  /**
   * Обновить интегральные BOS-показатели для сотрудника
   * 
   * Вызывается после завершения BOS-анализа встречи.
   * Пересчитывает агрегат на основе последних 6 встреч.
   * 
   * @param employeeId - ID сотрудника
   */
  static async updateAggregate(employeeId: string): Promise<void> {
    try {
      console.log(`[BOSAggregateService] Обновляем агрегат для сотрудника ${employeeId}`);

      // 1. Получаем последние 6 завершённых BOS-наблюдений
      const observations = await BOSObservationEntity.findByEmployeeId(employeeId, {
        limit: MAX_MEETINGS,
        status: 'completed'
      });

      if (observations.length === 0) {
        console.log(`[BOSAggregateService] Нет BOS-данных для сотрудника ${employeeId}`);
        return;
      }

      // 2. Рассчитываем агрегированные оценки
      const aggregateScores = this.calculateAggregateScores(observations);

      // 3. Сохраняем в БД
      await EmployeeBOSAggregateEntity.upsert({
        employee_id: employeeId,
        scores: aggregateScores,
        meetings_count: observations.length
      });

      console.log(`[BOSAggregateService] Агрегат обновлён для сотрудника ${employeeId}, встреч: ${observations.length}`);

    } catch (error) {
      console.error(`[BOSAggregateService] Ошибка обновления агрегата для ${employeeId}:`, error);
      // Не пробрасываем ошибку - это фоновая операция
    }
  }

  /**
   * Рассчитать агрегированные оценки по всем 12 поведениям
   * 
   * @param observations - массив BOS-наблюдений (от новых к старым)
   * @returns объект с агрегированными оценками
   */
  private static calculateAggregateScores(observations: BOSObservation[]): BOSAggregateScores {
    const result: BOSAggregateScores = {};

    for (const behaviorKey of BOS_BEHAVIOR_KEYS) {
      result[behaviorKey] = this.calculateBehaviorScore(observations, behaviorKey);
    }

    return result;
  }

  /**
   * Рассчитать взвешенную оценку для одного поведения
   * 
   * Использует exponential decay: чем старее встреча, тем меньше её вес.
   * Веса нормализуются по тем встречам, где есть оценка данного поведения.
   * 
   * @param observations - массив BOS-наблюдений (от новых к старым)
   * @param behaviorKey - ключ поведения
   * @returns взвешенная оценка (1-5) или null если нет данных
   */
  private static calculateBehaviorScore(
    observations: BOSObservation[], 
    behaviorKey: BOSBehaviorKey
  ): number | null {
    let weightedSum = 0;
    let totalWeight = 0;

    // Берём максимум 6 встреч
    const recentObservations = observations.slice(0, MAX_MEETINGS);

    for (let i = 0; i < recentObservations.length; i++) {
      const observation = recentObservations[i];
      const scoreData = observation.scores?.[behaviorKey];
      
      // Проверяем, есть ли оценка для этого поведения
      if (scoreData && scoreData.score !== null && scoreData.score !== undefined) {
        const weight = DECAY_WEIGHTS[i];
        weightedSum += scoreData.score * weight;
        totalWeight += weight;
      }
    }

    // Если нет ни одной оценки - возвращаем null
    if (totalWeight === 0) {
      return null;
    }

    // Нормализуем результат по фактическим весам
    const aggregateScore = weightedSum / totalWeight;

    // Округляем до 1 знака после запятой для хранения
    return Math.round(aggregateScore * 10) / 10;
  }

  /**
   * Получить интегральные BOS-показатели для сотрудника
   * 
   * @param employeeId - ID сотрудника
   * @returns агрегат или null если нет данных
   */
  static async getAggregate(employeeId: string) {
    return EmployeeBOSAggregateEntity.findByEmployeeId(employeeId);
  }

  /**
   * Принудительно пересчитать агрегат для сотрудника
   * 
   * @param employeeId - ID сотрудника
   */
  static async recalculate(employeeId: string): Promise<void> {
    await this.updateAggregate(employeeId);
  }
}


