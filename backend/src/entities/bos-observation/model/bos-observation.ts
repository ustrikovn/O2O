/**
 * Модель сущности BOSObservation (BOS-наблюдение встречи)
 */

import { query } from '@/shared/database/connection.js';
import type {
  BOSObservation,
  BOSObservationStatus,
  BOSScores,
  BOSMetadata,
  CreateBOSObservationInput,
  UpdateBOSObservationInput
} from '@/features/assistant/agents/bos-types.js';

export class BOSObservationEntity {
  /**
   * Создание новой записи BOS-наблюдения (статус pending)
   */
  static async create(data: CreateBOSObservationInput): Promise<BOSObservation> {
    const sql = `
      INSERT INTO meeting_bos_observations (meeting_id, employee_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *;
    `;

    const result = await query(sql, [data.meeting_id, data.employee_id]);
    return this.mapRowToObservation(result.rows[0]);
  }

  /**
   * Получение BOS-наблюдения по ID встречи
   */
  static async findByMeetingId(meetingId: string): Promise<BOSObservation | null> {
    const sql = `
      SELECT * FROM meeting_bos_observations
      WHERE meeting_id = $1;
    `;

    const result = await query(sql, [meetingId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToObservation(result.rows[0]);
  }

  /**
   * Получение истории BOS-наблюдений для сотрудника
   */
  static async findByEmployeeId(
    employeeId: string,
    options: { limit?: number; offset?: number; status?: BOSObservationStatus } = {}
  ): Promise<BOSObservation[]> {
    const { limit = 50, offset = 0, status } = options;

    let sql = `
      SELECT * FROM meeting_bos_observations
      WHERE employee_id = $1
    `;
    const params: any[] = [employeeId];
    let paramIdx = 2;

    if (status) {
      sql += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows.map(row => this.mapRowToObservation(row));
  }

  /**
   * Обновление статуса на 'processing'
   */
  static async markProcessing(meetingId: string): Promise<BOSObservation | null> {
    const sql = `
      UPDATE meeting_bos_observations
      SET status = 'processing'
      WHERE meeting_id = $1 AND status = 'pending'
      RETURNING *;
    `;

    const result = await query(sql, [meetingId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToObservation(result.rows[0]);
  }

  /**
   * Завершение анализа с результатами
   */
  static async complete(
    meetingId: string,
    scores: BOSScores,
    metadata: BOSMetadata
  ): Promise<BOSObservation | null> {
    const sql = `
      UPDATE meeting_bos_observations
      SET 
        status = 'completed',
        scores = $2,
        metadata = $3,
        completed_at = CURRENT_TIMESTAMP
      WHERE meeting_id = $1
      RETURNING *;
    `;

    const result = await query(sql, [
      meetingId,
      JSON.stringify(scores),
      JSON.stringify(metadata)
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToObservation(result.rows[0]);
  }

  /**
   * Пометить как failed с сообщением об ошибке
   */
  static async markFailed(meetingId: string, errorMessage: string): Promise<BOSObservation | null> {
    const sql = `
      UPDATE meeting_bos_observations
      SET 
        status = 'failed',
        error_message = $2,
        completed_at = CURRENT_TIMESTAMP
      WHERE meeting_id = $1
      RETURNING *;
    `;

    const result = await query(sql, [meetingId, errorMessage]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToObservation(result.rows[0]);
  }

  /**
   * Удаление BOS-наблюдения (для перезапуска анализа)
   */
  static async delete(meetingId: string): Promise<boolean> {
    const sql = `
      DELETE FROM meeting_bos_observations
      WHERE meeting_id = $1
      RETURNING id;
    `;

    const result = await query(sql, [meetingId]);
    return result.rows.length > 0;
  }

  /**
   * Проверка существования BOS-наблюдения для встречи
   */
  static async exists(meetingId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM meeting_bos_observations
      WHERE meeting_id = $1
      LIMIT 1;
    `;

    const result = await query(sql, [meetingId]);
    return result.rows.length > 0;
  }

  /**
   * Получение статистики BOS для сотрудника
   */
  static async getEmployeeStats(employeeId: string): Promise<{
    total_observations: number;
    completed_observations: number;
    average_scores: Record<string, number | null>;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM meeting_bos_observations
      WHERE employee_id = $1;
    `;

    const result = await query(sql, [employeeId]);
    const stats = result.rows[0];

    // Средние оценки пока не вычисляем (для трендов в будущем)
    return {
      total_observations: parseInt(stats.total),
      completed_observations: parseInt(stats.completed),
      average_scores: {}
    };
  }

  /**
   * Преобразование строки БД в объект BOSObservation
   */
  private static mapRowToObservation(row: any): BOSObservation {
    return {
      id: row.id,
      meeting_id: row.meeting_id,
      employee_id: row.employee_id,
      status: row.status,
      error_message: row.error_message || null,
      scores: typeof row.scores === 'string' 
        ? JSON.parse(row.scores) 
        : (row.scores || {}),
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : (row.metadata || {}),
      created_at: row.created_at,
      completed_at: row.completed_at || null
    };
  }
}
