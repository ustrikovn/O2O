/**
 * Модель сущности EmployeeBOSAggregate
 * 
 * Интегральные BOS-показатели сотрудника с exponential decay
 * по последним 6 встречам.
 */

import { query } from '@/shared/database/connection.js';
import type { BOSBehaviorKey } from '@/features/assistant/agents/bos-types.js';

/**
 * Агрегированные оценки по 12 BOS-поведениям
 * Значение: число от 1 до 5 (с дробной частью) или null если нет данных
 */
export type BOSAggregateScores = Partial<Record<BOSBehaviorKey, number | null>>;

/**
 * Полная запись интегральных BOS-показателей
 */
export interface EmployeeBOSAggregate {
  id: string;
  employee_id: string;
  scores: BOSAggregateScores;
  meetings_count: number;
  updated_at: Date;
}

/**
 * Данные для создания/обновления агрегата
 */
export interface UpsertBOSAggregateInput {
  employee_id: string;
  scores: BOSAggregateScores;
  meetings_count: number;
}

export class EmployeeBOSAggregateEntity {
  /**
   * Получение агрегата по ID сотрудника
   */
  static async findByEmployeeId(employeeId: string): Promise<EmployeeBOSAggregate | null> {
    const sql = `
      SELECT * FROM employee_bos_aggregate
      WHERE employee_id = $1;
    `;

    const result = await query(sql, [employeeId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAggregate(result.rows[0]);
  }

  /**
   * Создать или обновить агрегат (UPSERT)
   */
  static async upsert(data: UpsertBOSAggregateInput): Promise<EmployeeBOSAggregate> {
    const sql = `
      INSERT INTO employee_bos_aggregate (employee_id, scores, meetings_count, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (employee_id) 
      DO UPDATE SET 
        scores = $2,
        meetings_count = $3,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const result = await query(sql, [
      data.employee_id,
      JSON.stringify(data.scores),
      data.meetings_count
    ]);

    return this.mapRowToAggregate(result.rows[0]);
  }

  /**
   * Удаление агрегата (при удалении сотрудника - каскадно)
   */
  static async delete(employeeId: string): Promise<boolean> {
    const sql = `
      DELETE FROM employee_bos_aggregate
      WHERE employee_id = $1
      RETURNING id;
    `;

    const result = await query(sql, [employeeId]);
    return result.rows.length > 0;
  }

  /**
   * Проверка существования агрегата
   */
  static async exists(employeeId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM employee_bos_aggregate
      WHERE employee_id = $1
      LIMIT 1;
    `;

    const result = await query(sql, [employeeId]);
    return result.rows.length > 0;
  }

  /**
   * Преобразование строки БД в объект
   */
  private static mapRowToAggregate(row: any): EmployeeBOSAggregate {
    return {
      id: row.id,
      employee_id: row.employee_id,
      scores: typeof row.scores === 'string' 
        ? JSON.parse(row.scores) 
        : (row.scores || {}),
      meetings_count: row.meetings_count,
      updated_at: row.updated_at
    };
  }
}


