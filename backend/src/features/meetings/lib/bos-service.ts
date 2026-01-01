/**
 * BOS Service
 * 
 * Сервис для запуска BOS-анализа при завершении встречи.
 * Работает асинхронно, не блокирует завершение встречи.
 */

import { BOSAnalyzerAgent } from '@/features/assistant/agents/bos-analyzer.js';
import { BOSObservationEntity } from '@/entities/bos-observation/index.js';
import { MeetingEntity } from '@/entities/meeting/index.js';
import { AgreementEntity } from '@/entities/agreement/model/agreement.js';
import { query } from '@/shared/database/connection.js';
import { BOSAggregateService } from './bos-aggregate-service.js';
import type { BOSAnalysisInput, BOSAgreementInput, BOSMetadata } from '@/features/assistant/agents/bos-types.js';

/**
 * Получение данных сотрудника по ID
 */
async function getEmployeeData(employeeId: string): Promise<{ name: string } | null> {
  const sql = `
    SELECT first_name, last_name 
    FROM employees 
    WHERE id = $1;
  `;
  
  const result = await query(sql, [employeeId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    name: `${row.first_name} ${row.last_name}`
  };
}

/**
 * BOS Service - управление BOS-анализом встреч
 */
export class BOSService {
  private static agent = new BOSAnalyzerAgent();

  /**
   * Запустить BOS-анализ для встречи (асинхронно)
   * 
   * Вызывается при завершении встречи. Не блокирует процесс.
   * 
   * @param meetingId - ID завершённой встречи
   */
  static async triggerAnalysis(meetingId: string): Promise<void> {
    // Запускаем асинхронно, не ждём результата
    this.runAnalysis(meetingId).catch(error => {
      console.error(`[BOSService] Ошибка анализа для встречи ${meetingId}:`, error);
    });
  }

  /**
   * Выполнить BOS-анализ (внутренний метод)
   */
  private static async runAnalysis(meetingId: string): Promise<void> {
    console.log(`[BOSService] Начинаем BOS-анализ для встречи ${meetingId}`);

    try {
      // 1. Получаем данные встречи
      const meeting = await MeetingEntity.findById(meetingId);
      if (!meeting) {
        console.error(`[BOSService] Встреча ${meetingId} не найдена`);
        return;
      }

      // 2. Проверяем, не запущен ли уже анализ
      const existingObservation = await BOSObservationEntity.findByMeetingId(meetingId);
      if (existingObservation) {
        console.log(`[BOSService] BOS-наблюдение для встречи ${meetingId} уже существует (статус: ${existingObservation.status})`);
        return;
      }

      // 3. Получаем данные сотрудника
      const employee = await getEmployeeData(meeting.employee_id);
      if (!employee) {
        console.error(`[BOSService] Сотрудник ${meeting.employee_id} не найден`);
        return;
      }

      // 4. Получаем договорённости, созданные на этой встрече
      const agreements = await AgreementEntity.getByMeetingId(meetingId);
      const agreementsInput: BOSAgreementInput[] = agreements.map(a => ({
        title: a.title,
        description: a.description,
        type: a.responsible_type as 'employee_task' | 'manager_task'
      }));

      // 5. Получаем заметки из content встречи
      const notes = meeting.content?.notes || '';

      // 6. Проверяем, есть ли данные для анализа
      if (!notes && agreementsInput.length === 0) {
        console.log(`[BOSService] Нет данных для анализа встречи ${meetingId} (нет заметок и договорённостей)`);
        return;
      }

      // 7. Создаём запись в БД (статус pending)
      await BOSObservationEntity.create({
        meeting_id: meetingId,
        employee_id: meeting.employee_id
      });

      // 8. Обновляем статус на processing
      await BOSObservationEntity.markProcessing(meetingId);

      // 9. Формируем входные данные для анализа
      const input: BOSAnalysisInput = {
        meetingId,
        employeeId: meeting.employee_id,
        employeeName: employee.name,
        notes,
        agreements: agreementsInput
      };

      // 10. Запускаем анализ
      const { output, durationMs } = await this.agent.analyze(input);

      // 11. Формируем метаданные
      const metadata: BOSMetadata = {
        model: 'claude-sonnet-4-20250514',
        generation_time_ms: durationMs,
        input_data: {
          notes_length: notes.length,
          agreements_count: agreementsInput.length
        }
      };

      // 12. Сохраняем результат
      await BOSObservationEntity.complete(meetingId, output.scores, metadata);

      console.log(`[BOSService] BOS-анализ завершён для встречи ${meetingId} за ${durationMs}ms`);

      // 13. Обновляем интегральный BOS-агрегат сотрудника
      await BOSAggregateService.updateAggregate(meeting.employee_id);

    } catch (error) {
      console.error(`[BOSService] Ошибка BOS-анализа для встречи ${meetingId}:`, error);
      
      // Пытаемся пометить как failed
      try {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await BOSObservationEntity.markFailed(meetingId, errorMessage);
      } catch (dbError) {
        console.error(`[BOSService] Не удалось пометить как failed:`, dbError);
      }
    }
  }

  /**
   * Перезапустить BOS-анализ для встречи
   * 
   * Удаляет существующее наблюдение и запускает анализ заново.
   * 
   * @param meetingId - ID встречи
   */
  static async retryAnalysis(meetingId: string): Promise<void> {
    // Удаляем существующее наблюдение
    await BOSObservationEntity.delete(meetingId);
    
    // Запускаем анализ заново
    await this.runAnalysis(meetingId);
  }

  /**
   * Получить статус BOS-анализа для встречи
   */
  static async getStatus(meetingId: string): Promise<{
    exists: boolean;
    status?: string;
    completed?: boolean;
  }> {
    const observation = await BOSObservationEntity.findByMeetingId(meetingId);
    
    if (!observation) {
      return { exists: false };
    }
    
    return {
      exists: true,
      status: observation.status,
      completed: observation.status === 'completed'
    };
  }
}
