import { BaseEntity, UUID } from '../../../shared/types/common.js';
import { query } from '../../../shared/database/connection.js';

export type AgreementStatus = 'pending' | 'marked_for_completion' | 'completed';
export type ResponsibleType = 'employee_task' | 'manager_task';

export interface Agreement extends BaseEntity {
  meeting_id: UUID;
  employee_id: UUID;
  title: string;
  description?: string;
  responsible_type: ResponsibleType;
  status: AgreementStatus;
  due_date?: string; // YYYY-MM-DD format
  completed_at?: Date;
}

export interface CreateAgreementDto {
  meeting_id: UUID;
  employee_id: UUID;
  title: string;
  description?: string;
  responsible_type: ResponsibleType;
  due_date?: string;
}

export interface UpdateAgreementStatusDto {
  id: UUID;
  status: AgreementStatus;
}

export class AgreementEntity {
  /**
   * Создание новой договоренности
   */
  static async create(data: CreateAgreementDto): Promise<Agreement | null> {
    const sql = `
      INSERT INTO agreements (meeting_id, employee_id, title, description, responsible_type, due_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    
    const values = [
      data.meeting_id,
      data.employee_id,
      data.title,
      data.description || null,
      data.responsible_type,
      data.due_date || null
    ];
    
    try {
      const result = await query(sql, values);
      return result.rows[0] as Agreement;
    } catch (error) {
      console.error('Ошибка создания договоренности:', error);
      return null;
    }
  }

  /**
   * Получение всех открытых договоренностей для сотрудника
   */
  static async getOpenByEmployeeId(employeeId: UUID): Promise<Agreement[]> {
    const sql = `
      SELECT * FROM agreements 
      WHERE employee_id = $1 
        AND status IN ('pending', 'marked_for_completion')
      ORDER BY created_at ASC;
    `;
    
    try {
      const result = await query(sql, [employeeId]);
      return result.rows as Agreement[];
    } catch (error) {
      console.error('Ошибка получения договоренностей:', error);
      return [];
    }
  }

  /**
   * Получение договоренностей для конкретной встречи
   */
  static async getByMeetingId(meetingId: UUID): Promise<Agreement[]> {
    const sql = `
      SELECT * FROM agreements 
      WHERE meeting_id = $1 
      ORDER BY created_at ASC;
    `;
    
    try {
      const result = await query(sql, [meetingId]);
      return result.rows as Agreement[];
    } catch (error) {
      console.error('Ошибка получения договоренностей встречи:', error);
      return [];
    }
  }

  /**
   * Обновление статуса договоренности
   */
  static async updateStatus(agreementId: UUID, status: AgreementStatus): Promise<Agreement | null> {
    const completedAt = status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL';
    
    const sql = `
      UPDATE agreements 
      SET 
        status = $2,
        completed_at = ${completedAt}
      WHERE id = $1
      RETURNING *;
    `;
    
    try {
      const result = await query(sql, [agreementId, status]);
      return result.rows[0] as Agreement || null;
    } catch (error) {
      console.error('Ошибка обновления статуса договоренности:', error);
      return null;
    }
  }

  /**
   * Завершение всех "помеченных к выполнению" договоренностей при окончании встречи
   */
  static async completeMarkedAgreements(meetingId: UUID): Promise<number> {
    const sql = `
      UPDATE agreements 
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
      WHERE meeting_id = $1 
        AND status = 'marked_for_completion'
      RETURNING id;
    `;
    
    try {
      const result = await query(sql, [meetingId]);
      console.log(`✅ Завершено ${result.rows.length} договоренностей при окончании встречи`);
      return result.rows.length;
    } catch (error) {
      console.error('Ошибка завершения помеченных договоренностей:', error);
      return 0;
    }
  }

  /**
   * Получение статистики по договоренностям сотрудника
   */
  static async getEmployeeStats(employeeId: UUID): Promise<{
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' OR status = 'marked_for_completion' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status != 'completed' AND due_date < CURRENT_DATE THEN 1 END) as overdue
      FROM agreements 
      WHERE employee_id = $1;
    `;
    
    try {
      const result = await query(sql, [employeeId]);
      const row = result.rows[0];
      return {
        total: parseInt(row.total),
        pending: parseInt(row.pending),
        completed: parseInt(row.completed),
        overdue: parseInt(row.overdue)
      };
    } catch (error) {
      console.error('Ошибка получения статистики договоренностей:', error);
      return { total: 0, pending: 0, completed: 0, overdue: 0 };
    }
  }

  /**
   * Завершение всех "помеченных к выполнению" договоренностей сотрудника
   * Используется при окончании встречи, чтобы закрыть задачи, тянущиеся из прошлых встреч
   */
  static async completeMarkedAgreementsByEmployee(employeeId: UUID): Promise<number> {
    const sql = `
      UPDATE agreements 
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1 
        AND status = 'marked_for_completion'
      RETURNING id;
    `;

    try {
      const result = await query(sql, [employeeId]);
      console.log(`✅ Завершено ${result.rows.length} договоренностей сотрудника ${employeeId}`);
      return result.rows.length;
    } catch (error) {
      console.error('Ошибка завершения помеченных договоренностей сотрудника:', error);
      return 0;
    }
  }

  /**
   * Получение договоренностей для встречи с информацией об их состоянии на момент встречи
   */
  static async getAgreementsInMeetingContext(meetingId: UUID, employeeId: UUID, meetingStartedAt?: Date, meetingEndedAt?: Date): Promise<{
    created: Agreement[];     // Созданы на этой встрече
    completed: Agreement[];   // Закрыты на этой встрече  
    active: Agreement[];      // Были активны на момент встречи
  }> {
    try {
      // 1. Договоренности, созданные на этой встрече
      const createdSql = `
        SELECT * FROM agreements 
        WHERE meeting_id = $1 
        ORDER BY created_at ASC;
      `;
      const createdResult = await query(createdSql, [meetingId]);
      const created = createdResult.rows as Agreement[];

      let completed: Agreement[] = [];
      let active: Agreement[] = [];

      // Если есть временные рамки встречи, определяем закрытые и активные договоренности
      if (meetingStartedAt) {
        const endedAtWithMargin = meetingEndedAt ? new Date(meetingEndedAt.getTime() + 5000) : undefined;
        // 2. Договоренности, закрытые во время этой встречи
        const completedSql = `
          SELECT * FROM agreements 
          WHERE employee_id = $1 
            AND completed_at IS NOT NULL
            AND completed_at >= $2
            ${meetingEndedAt ? 'AND completed_at <= $3' : ''}
          ORDER BY completed_at ASC;
        `;
        const completedParams = meetingEndedAt 
          ? [employeeId, meetingStartedAt, endedAtWithMargin]
          : [employeeId, meetingStartedAt];
        
        const completedResult = await query(completedSql, completedParams);
        completed = completedResult.rows as Agreement[];

        // 3. Договоренности, которые были активны на момент встречи
        // (созданы до встречи И ещё НЕ были завершены на момент начала встречи)
        const activeSql = `
          SELECT * FROM agreements 
          WHERE employee_id = $1 
            AND meeting_id != $2
            AND created_at < $3
            AND (completed_at IS NULL OR completed_at >= $3)
          ORDER BY created_at ASC;
        `;
        const activeParams = [employeeId, meetingId, meetingStartedAt];
          
        const activeResult = await query(activeSql, activeParams);
        active = activeResult.rows as Agreement[];
      }

      // Убираем дублирования - если договорённость есть в нескольких категориях
      const createdIds = new Set(created.map(a => a.id));
      const completedIds = new Set(completed.map(a => a.id));
      
      // Из активных убираем те, что уже есть в созданных или закрытых
      const filteredActive = active.filter(a => !createdIds.has(a.id) && !completedIds.has(a.id));
      
      console.log(`Договорённости для встречи ${meetingId}: создано ${created.length}, закрыто ${completed.length}, активно ${filteredActive.length}`);
      
      return { created, completed, active: filteredActive };
    } catch (error) {
      console.error('Ошибка получения договоренностей в контексте встречи:', error);
      return { created: [], completed: [], active: [] };
    }
  }
}
