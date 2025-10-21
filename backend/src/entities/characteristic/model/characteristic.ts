/**
 * Модель сущности Characteristic (Характеристика сотрудника)
 */

import { query } from '@/shared/database/connection.js';
import { 
  EmployeeCharacteristic,
  CreateCharacteristicInput,
  UpdateCharacteristicInput,
  CharacteristicMetadata
} from '@/shared/types/characteristic.js';

export class CharacteristicEntity {
  /**
   * Создание новой характеристики для сотрудника
   */
  static async create(data: CreateCharacteristicInput): Promise<EmployeeCharacteristic> {
    const { employee_id, content, changes_summary, metadata } = data;
    
    const sql = `
      INSERT INTO employee_characteristics (
        employee_id, 
        content, 
        changes_summary,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    const values = [
      employee_id,
      content,
      changes_summary || null,
      JSON.stringify(metadata)
    ];
    
    try {
      const result = await query(sql, values);
      const row = result.rows[0];
      return this.mapRowToCharacteristic(row);
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Характеристика для этого сотрудника уже существует');
      }
      throw error;
    }
  }
  
  /**
   * Получение характеристики сотрудника по employee_id
   */
  static async findByEmployeeId(employeeId: string): Promise<EmployeeCharacteristic | null> {
    const sql = `
      SELECT * FROM employee_characteristics
      WHERE employee_id = $1;
    `;
    
    const result = await query(sql, [employeeId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToCharacteristic(result.rows[0]);
  }
  
  /**
   * Обновление характеристики сотрудника
   */
  static async update(
    employeeId: string, 
    data: UpdateCharacteristicInput
  ): Promise<EmployeeCharacteristic | null> {
    const { content, changes_summary, metadata } = data;
    
    const sql = `
      UPDATE employee_characteristics 
      SET 
        content = $2,
        changes_summary = $3,
        metadata = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1
      RETURNING *;
    `;
    
    const values = [
      employeeId,
      content,
      changes_summary || null,
      JSON.stringify(metadata)
    ];
    
    const result = await query(sql, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToCharacteristic(result.rows[0]);
  }
  
  /**
   * Создание или обновление характеристики (upsert)
   */
  static async upsert(
    employeeId: string,
    data: Omit<CreateCharacteristicInput, 'employee_id'>
  ): Promise<EmployeeCharacteristic> {
    const existing = await this.findByEmployeeId(employeeId);
    
    if (existing) {
      const updated = await this.update(employeeId, data);
      if (!updated) {
        throw new Error('Не удалось обновить характеристику');
      }
      return updated;
    } else {
      return await this.create({
        employee_id: employeeId,
        ...data
      });
    }
  }
  
  /**
   * Удаление характеристики сотрудника
   */
  static async delete(employeeId: string): Promise<boolean> {
    const sql = `
      DELETE FROM employee_characteristics
      WHERE employee_id = $1
      RETURNING id;
    `;
    
    const result = await query(sql, [employeeId]);
    return result.rows.length > 0;
  }
  
  /**
   * Получение всех характеристик (с пагинацией)
   */
  static async findAll(options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<EmployeeCharacteristic[]> {
    const { limit = 50, offset = 0 } = options;
    
    const sql = `
      SELECT * FROM employee_characteristics
      ORDER BY updated_at DESC
      LIMIT $1 OFFSET $2;
    `;
    
    const result = await query(sql, [limit, offset]);
    return result.rows.map(row => this.mapRowToCharacteristic(row));
  }
  
  /**
   * Получение характеристик с низкой наполненностью данных
   */
  static async findWithLowDataRichness(threshold: number = 30): Promise<EmployeeCharacteristic[]> {
    const sql = `
      SELECT * FROM employee_characteristics
      WHERE (metadata->>'data_richness_score')::int < $1
      ORDER BY (metadata->>'data_richness_score')::int ASC;
    `;
    
    const result = await query(sql, [threshold]);
    return result.rows.map(row => this.mapRowToCharacteristic(row));
  }
  
  /**
   * Получение устаревших характеристик (не обновлялись N дней)
   */
  static async findStale(daysOld: number = 30): Promise<EmployeeCharacteristic[]> {
    const sql = `
      SELECT * FROM employee_characteristics
      WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
      ORDER BY updated_at ASC;
    `;
    
    const result = await query(sql);
    return result.rows.map(row => this.mapRowToCharacteristic(row));
  }
  
  /**
   * Преобразование строки БД в объект EmployeeCharacteristic
   */
  private static mapRowToCharacteristic(row: any): EmployeeCharacteristic {
    return {
      id: row.id,
      employee_id: row.employee_id,
      content: row.content,
      previous_content: row.previous_content || null,
      changes_summary: row.changes_summary || null,
      metadata: typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}


