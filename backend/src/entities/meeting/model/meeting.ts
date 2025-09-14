/**
 * Полностью JSON модель сущности Meeting
 */

import { query } from '@/shared/database/connection.js';
import { AgreementEntity } from '../../agreement/model/agreement.js';
import { 
  Meeting,
  MeetingStatus,
  MeetingContent,
  Agreement,
  AgreementType,
  CreateMeetingDto,
  StartMeetingDto,
  EndMeetingDto,
  UpdateMeetingNotesDto,
  AddAgreementDto,
  UpdateAgreementDto,
  UpdateAgreementStatusDto,
  MeetingFilterParams,
  MeetingStats,
  EmployeeMeetingStats
} from '@/shared/types/meeting.js';
import { UUID } from '@/shared/types/common.js';

export class MeetingEntity {
  /**
   * Создание новой встречи
   */
  static async create(meetingData: CreateMeetingDto): Promise<Meeting> {
    const { employeeId } = meetingData;
    
    const sql = `
      INSERT INTO meetings (employee_id, status, content)
      VALUES ($1, 'scheduled', '{}'::jsonb)
      RETURNING *;
    `;
    
    const result = await query(sql, [employeeId]);
    const meeting = result.rows[0];
    
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Начать встречу
   */
  static async startMeeting(meetingId: UUID, data: StartMeetingDto = {}): Promise<Meeting | null> {
    const startedAt = data.startedAt || new Date();
    
    const sql = `
      UPDATE meetings 
      SET 
        status = 'active',
        started_at = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'scheduled'
      RETURNING *;
    `;
    
    const result = await query(sql, [meetingId, startedAt]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Завершить встречу
   */
  static async endMeeting(meetingId: UUID, data: EndMeetingDto = {}): Promise<Meeting | null> {
    const { endedAt, notes } = data;
    const endTime = endedAt || new Date();
    
    let sql: string;
    let values: any[];
    
    if (notes) {
      // Обновляем заметки в JSON + время завершения
      sql = `
        UPDATE meetings 
        SET 
          status = 'completed',
          ended_at = $2,
          content = jsonb_set(COALESCE(content, '{}'::jsonb), '{notes}', $3::jsonb),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'active'
        RETURNING *;
      `;
      values = [meetingId, endTime, JSON.stringify(notes)];
    } else {
      // Только время завершения
      sql = `
        UPDATE meetings 
        SET 
          status = 'completed',
          ended_at = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'active'
        RETURNING *;
      `;
      values = [meetingId, endTime];
    }
    
    const result = await query(sql, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // НОВАЯ ЛОГИКА: Завершаем помеченные договоренности при окончании встречи
    try {
      const completedCount = await AgreementEntity.completeMarkedAgreements(meetingId);
      console.log(`✅ При завершении встречи ${meetingId} завершено ${completedCount} договоренностей`);
    } catch (error) {
      console.error('⚠️ Ошибка завершения договоренностей при окончании встречи:', error);
      // Не прерываем процесс завершения встречи из-за ошибки с договоренностями
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Получение встречи по ID
   */
  static async findById(id: UUID): Promise<Meeting | null> {
    const sql = `
      SELECT * FROM meetings WHERE id = $1;
    `;
    
    const result = await query(sql, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Получение детальной информации о встрече с данными сотрудника
   */
  static async findDetailedById(id: UUID): Promise<any | null> {
    const sql = `
      SELECT 
        m.*,
        e.first_name,
        e.last_name,
        e.email,
        e.photo_url
      FROM meetings m
      JOIN employees e ON m.employee_id = e.id
      WHERE m.id = $1;
    `;
    
    const result = await query(sql, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    
    return {
      ...meeting,
      employeeId: meeting.employee_id,
      content: meeting.content || {},
      employee: {
        id: meeting.employee_id,
        firstName: meeting.first_name,
        lastName: meeting.last_name,
        email: meeting.email,
        photoUrl: meeting.photo_url
      }
    };
  }

  /**
   * Получение всех встреч с фильтрацией
   */
  static async findAll(filters: MeetingFilterParams = {}, limit = 50, offset = 0): Promise<Meeting[]> {
    let sql = `
      SELECT m.*, e.first_name, e.last_name, e.email, e.photo_url
      FROM meetings m
      JOIN employees e ON m.employee_id = e.id
      WHERE 1=1
    `;
    
    const values: any[] = [];
    let paramCount = 0;
    
    // Применяем фильтры
    if (filters.employeeId) {
      sql += ` AND m.employee_id = $${++paramCount}`;
      values.push(filters.employeeId);
    }
    
    if (filters.status) {
      sql += ` AND m.status = $${++paramCount}`;
      values.push(filters.status);
    }
    
    if (filters.dateFrom) {
      sql += ` AND m.started_at >= $${++paramCount}`;
      values.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      sql += ` AND m.started_at <= $${++paramCount}`;
      values.push(filters.dateTo);
    }
    
    if (filters.hasNotes) {
      sql += ` AND m.content->>'notes' IS NOT NULL AND m.content->>'notes' != ''`;
    }
    
    if (filters.hasAgreements) {
      sql += ` AND m.content->'agreements' IS NOT NULL AND jsonb_array_length(m.content->'agreements') > 0`;
    }
    
    sql += ` ORDER BY m.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    values.push(limit, offset);
    
    const result = await query(sql, values);
    
    return result.rows.map(row => ({
      ...row,
      content: row.content || {}
    })) as Meeting[];
  }

  /**
   * Получение активной встречи для сотрудника
   */
  static async findActiveByEmployeeId(employeeId: UUID): Promise<Meeting | null> {
    const sql = `
      SELECT * FROM meetings 
      WHERE employee_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
    `;
    
    const result = await query(sql, [employeeId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Обновление заметок встречи
   */
  static async updateNotes(id: UUID, updateData: UpdateMeetingNotesDto): Promise<Meeting | null> {
    const { notes } = updateData;
    
    const sql = `
      UPDATE meetings 
      SET 
        content = jsonb_set(COALESCE(content, '{}'::jsonb), '{notes}', $2::jsonb),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    const result = await query(sql, [id, JSON.stringify(notes)]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Отмена встречи
   */
  static async cancel(id: UUID): Promise<Meeting | null> {
    const sql = `
      UPDATE meetings 
      SET 
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('scheduled', 'active')
      RETURNING *;
    `;
    
    const result = await query(sql, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Добавление договоренности к встрече
   */
  static async addAgreement(meetingId: UUID, agreementData: AddAgreementDto): Promise<Meeting | null> {
    const { title, description, type, dueDate } = agreementData;
    
    // Создаем новую договоренность
    const newAgreement: Agreement = {
      id: `agreement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      type,
      status: 'pending', // Статус по умолчанию
      due_date: dueDate, // Планируемая дата выполнения
      created_at: new Date().toISOString()
    };
    
    const sql = `
      UPDATE meetings 
      SET 
        content = jsonb_set(
          COALESCE(content, '{}'::jsonb),
          '{agreements}',
          COALESCE(content->'agreements', '[]'::jsonb) || $2::jsonb
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    const result = await query(sql, [meetingId, JSON.stringify([newAgreement])]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Обновление договоренности
   */
  static async updateAgreement(meetingId: UUID, updateData: UpdateAgreementDto): Promise<Meeting | null> {
    const { agreementId, title, description, type } = updateData;
    
    // Получаем текущую встречу
    const meeting = await this.findById(meetingId);
    if (!meeting || !meeting.content.agreements) {
      return null;
    }
    
    // Обновляем договоренность в массиве
    const updatedAgreements = meeting.content.agreements.map(agreement => {
      if (agreement.id === agreementId) {
        return {
          ...agreement,
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(type && { type })
        };
      }
      return agreement;
    });
    
    const sql = `
      UPDATE meetings 
      SET 
        content = jsonb_set(content, '{agreements}', $2::jsonb),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    const result = await query(sql, [meetingId, JSON.stringify(updatedAgreements)]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const updatedMeeting = result.rows[0];
    return {
      ...updatedMeeting,
      content: updatedMeeting.content || {}
    } as Meeting;
  }

  /**
   * Удаление договоренности
   */
  static async removeAgreement(meetingId: UUID, agreementId: string): Promise<Meeting | null> {
    // Получаем текущую встречу
    const meeting = await this.findById(meetingId);
    if (!meeting || !meeting.content.agreements) {
      return null;
    }
    
    // Удаляем договоренность из массива
    const filteredAgreements = meeting.content.agreements.filter(agreement => agreement.id !== agreementId);
    
    const sql = `
      UPDATE meetings 
      SET 
        content = jsonb_set(content, '{agreements}', $2::jsonb),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    const result = await query(sql, [meetingId, JSON.stringify(filteredAgreements)]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const updatedMeeting = result.rows[0];
    return {
      ...updatedMeeting,
      content: updatedMeeting.content || {}
    } as Meeting;
  }

  /**
   * Обновление статуса договоренности
   */
  static async updateAgreementStatus(meetingId: UUID, updateData: UpdateAgreementStatusDto): Promise<Meeting | null> {
    const { agreementId, status } = updateData;
    
    // Получаем текущую встречу
    const meeting = await this.findById(meetingId);
    if (!meeting || !meeting.content.agreements) {
      return null;
    }
    
    // Обновляем статус договоренности в массиве
    const updatedAgreements = meeting.content.agreements.map(agreement => {
      if (agreement.id === agreementId) {
        const updatedAgreement: Agreement = {
          ...agreement,
          status
        };
        
        // Если статус "completed", добавляем время выполнения
        if (status === 'completed') {
          updatedAgreement.completed_at = new Date().toISOString();
        } else {
          // Если статус "pending", убираем время выполнения
          delete updatedAgreement.completed_at;
        }
        
        return updatedAgreement;
      }
      return agreement;
    });
    
    const sql = `
      UPDATE meetings 
      SET 
        content = jsonb_set(content, '{agreements}', $2::jsonb),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    const result = await query(sql, [meetingId, JSON.stringify(updatedAgreements)]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const updatedMeeting = result.rows[0];
    return {
      ...updatedMeeting,
      content: updatedMeeting.content || {}
    } as Meeting;
  }

  /**
   * Получение статистики встреч
   */
  static async getStats(): Promise<MeetingStats> {
    const sql = `
      SELECT 
        COUNT(*) as total_meetings,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_meetings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_meetings,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_meetings,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at))/60) as average_meeting_duration
      FROM meetings;
    `;
    
    const result = await query(sql);
    const stats = result.rows[0];
    
    return {
      totalMeetings: parseInt(stats.total_meetings),
      activeMeetings: parseInt(stats.active_meetings),
      completedMeetings: parseInt(stats.completed_meetings),
      scheduledMeetings: parseInt(stats.scheduled_meetings),
      averageMeetingDuration: stats.average_meeting_duration ? parseFloat(stats.average_meeting_duration) : null
    };
  }

  /**
   * Получение статистики встреч по сотруднику
   */
  static async getEmployeeStats(employeeId: UUID): Promise<EmployeeMeetingStats> {
    const sql = `
      SELECT 
        COUNT(*) as total_meetings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_meetings,
        MAX(started_at) as last_meeting_date,
        COALESCE(
          SUM(
            CASE 
              WHEN content->'agreements' IS NOT NULL 
              THEN jsonb_array_length(content->'agreements')
              ELSE 0
            END
          ), 
          0
        ) as total_agreements
      FROM meetings
      WHERE employee_id = $1;
    `;
    
    const result = await query(sql, [employeeId]);
    const stats = result.rows[0];
    
    return {
      employeeId,
      totalMeetings: parseInt(stats.total_meetings),
      completedMeetings: parseInt(stats.completed_meetings),
      lastMeetingDate: stats.last_meeting_date ? new Date(stats.last_meeting_date) : null,
      totalAgreements: parseInt(stats.total_agreements)
    };
  }

  /**
   * Получение последней завершенной встречи с договоренностями для сотрудника
   */
  static async findLastCompletedWithAgreements(employeeId: UUID): Promise<Meeting | null> {
    const sql = `
      SELECT * FROM meetings 
      WHERE employee_id = $1 
        AND status = 'completed' 
        AND content->'agreements' IS NOT NULL 
        AND jsonb_array_length(content->'agreements') > 0
      ORDER BY ended_at DESC
      LIMIT 1;
    `;
    
    const result = await query(sql, [employeeId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    return {
      ...meeting,
      content: meeting.content || {}
    } as Meeting;
  }

  /**
   * Получение любой активной встречи в системе с данными сотрудника
   */
  static async findAnyActive(): Promise<any | null> {
    const sql = `
      SELECT 
        m.*,
        e.first_name,
        e.last_name,
        e.email,
        e.photo_url
      FROM meetings m
      JOIN employees e ON m.employee_id = e.id
      WHERE m.status = 'active'
      ORDER BY m.started_at DESC
      LIMIT 1;
    `;
    
    const result = await query(sql);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const meeting = result.rows[0];
    
    return {
      ...meeting,
      employeeId: meeting.employee_id,
      content: meeting.content || {},
      employee: {
        id: meeting.employee_id,
        firstName: meeting.first_name,
        lastName: meeting.last_name,
        email: meeting.email,
        photoUrl: meeting.photo_url
      }
    };
  }
}
