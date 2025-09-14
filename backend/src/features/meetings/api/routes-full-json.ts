/**
 * Полностью JSON Routes для управления встречами
 */

import express, { Request, Response } from 'express';
import { MeetingEntity } from '@/entities/meeting/index.js';
import { 
  validateCreateMeeting,
  validateUpdateNotes,
  validateAddAgreement,
  validateUpdateAgreement,
  validateUpdateAgreementStatus
} from '../lib/validation.js';
import { 
  validateUUID, 
  validateQueryParams 
} from '@/shared/api/middleware.js';
import { ApiResponse } from '@/shared/types/common.js';
import { 
  MeetingResponse,
  MeetingFilterParams
} from '@/shared/types/meeting.js';

const router = express.Router();

/**
 * Преобразование Meeting в MeetingResponse
 */
function transformMeetingResponse(meeting: any): MeetingResponse {
  return {
    ...meeting,
    employeeId: meeting.employee_id,
    agreementsCount: meeting.content?.agreements ? meeting.content.agreements.length : 0,
    employee: meeting.first_name ? {
      id: meeting.employee_id,
      firstName: meeting.first_name,
      lastName: meeting.last_name,
      email: meeting.email,
      photoUrl: meeting.photo_url
    } : undefined
  };
}

/**
 * POST /api/meetings
 * Создание новой встречи
 */
router.post('/', validateCreateMeeting, async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.body;
    
    // Проверяем, нет ли активной встречи с этим сотрудником
    const activeMeeting = await MeetingEntity.findActiveByEmployeeId(employeeId);
    if (activeMeeting) {
      res.status(409).json({
        error: 'Конфликт',
        message: 'У этого сотрудника уже есть активная встреча'
      });
      return;
    }
    
    const meetingData = { employeeId };
    const newMeeting = await MeetingEntity.create(meetingData);
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Встреча успешно создана',
      data: transformMeetingResponse(newMeeting)
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Ошибка создания встречи:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось создать встречу'
    });
  }
});

/**
 * GET /api/meetings
 * Получение списка встреч с фильтрацией
 */
router.get('/', validateQueryParams, async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      employeeId, 
      status, 
      dateFrom, 
      dateTo, 
      hasNotes,
      hasAgreements,
      limit = 50, 
      offset = 0 
    } = req.query;
    
    const filters: MeetingFilterParams = {
      ...(employeeId && { employeeId: employeeId as string }),
      ...(status && { status: status as any }),
      ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
      ...(dateTo && { dateTo: new Date(dateTo as string) }),
      ...(hasNotes === 'true' && { hasNotes: true }),
      ...(hasAgreements === 'true' && { hasAgreements: true })
    };
    
    const meetings = await MeetingEntity.findAll(filters, Number(limit), Number(offset));
    const meetingsWithDetails = meetings.map(transformMeetingResponse);
    
    const response: ApiResponse<MeetingResponse[]> = {
      success: true,
      data: meetingsWithDetails,
      count: meetings.length
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения встреч:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить список встреч'
    });
  }
});

/**
 * GET /api/meetings/stats
 * Получение статистики встреч
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await MeetingEntity.getStats();
    
    const response: ApiResponse = {
      success: true,
      data: stats
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения статистики встреч:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить статистику встреч'
    });
  }
});

/**
 * GET /api/meetings/:id
 * Получение детальной информации о встрече
 */
router.get('/:id', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const meeting = await MeetingEntity.findDetailedById(meetingId);
    
    if (!meeting) {
      res.status(404).json({
        error: 'Встреча не найдена',
        message: 'Встреча с указанным ID не существует'
      });
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      data: meeting
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения встречи:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить данные встречи'
    });
  }
});

/**
 * POST /api/meetings/:id/start
 * Начать встречу
 */
router.post('/:id/start', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const { startedAt } = req.body;
    
    const startData = {
      startedAt: startedAt ? new Date(startedAt) : undefined
    };
    
    const startedMeeting = await MeetingEntity.startMeeting(meetingId, startData);
    
    if (!startedMeeting) {
      res.status(404).json({
        error: 'Встреча не найдена или не может быть начата',
        message: 'Встреча должна иметь статус "scheduled" для начала'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Встреча успешно начата',
      data: transformMeetingResponse(startedMeeting)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка начала встречи:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось начать встречу'
    });
  }
});

/**
 * POST /api/meetings/:id/end
 * Завершить встречу
 */
router.post('/:id/end', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const { endedAt, notes } = req.body;
    
    const endData = {
      endedAt: endedAt ? new Date(endedAt) : undefined,
      notes
    };
    
    const endedMeeting = await MeetingEntity.endMeeting(meetingId, endData);
    
    if (!endedMeeting) {
      res.status(404).json({
        error: 'Встреча не найдена или не может быть завершена',
        message: 'Встреча должна иметь статус "active" для завершения'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Встреча успешно завершена',
      data: transformMeetingResponse(endedMeeting)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка завершения встречи:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось завершить встречу'
    });
  }
});

/**
 * PUT /api/meetings/:id/notes
 * Обновление заметок встречи
 */
router.put('/:id/notes', validateUUID('id'), validateUpdateNotes, async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const { notes } = req.body;
    
    const updatedMeeting = await MeetingEntity.updateNotes(meetingId, { notes });
    
    if (!updatedMeeting) {
      res.status(404).json({
        error: 'Встреча не найдена',
        message: 'Встреча с указанным ID не существует'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Заметки успешно обновлены',
      data: transformMeetingResponse(updatedMeeting)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка обновления заметок:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось обновить заметки'
    });
  }
});

/**
 * POST /api/meetings/:id/agreements
 * Добавление договоренности к встрече
 */
router.post('/:id/agreements', validateUUID('id'), validateAddAgreement, async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const { title, description, type } = req.body;
    
    const agreementData = { title, description, type };
    const updatedMeeting = await MeetingEntity.addAgreement(meetingId, agreementData);
    
    if (!updatedMeeting) {
      res.status(404).json({
        error: 'Встреча не найдена',
        message: 'Встреча с указанным ID не существует'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Договоренность успешно добавлена',
      data: transformMeetingResponse(updatedMeeting)
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Ошибка добавления договоренности:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось добавить договоренность'
    });
  }
});

/**
 * PUT /api/meetings/:id/agreements
 * Обновление договоренности
 */
router.put('/:id/agreements', validateUUID('id'), validateUpdateAgreement, async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const updateData = req.body;
    
    const updatedMeeting = await MeetingEntity.updateAgreement(meetingId, updateData);
    
    if (!updatedMeeting) {
      res.status(404).json({
        error: 'Встреча или договоренность не найдены',
        message: 'Встреча с указанным ID не существует или договоренность не найдена'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Договоренность успешно обновлена',
      data: transformMeetingResponse(updatedMeeting)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка обновления договоренности:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось обновить договоренность'
    });
  }
});

/**
 * DELETE /api/meetings/:id/agreements/:agreementId
 * Удаление договоренности
 */
router.delete('/:id/agreements/:agreementId', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const agreementId = req.params.agreementId!;
    
    const updatedMeeting = await MeetingEntity.removeAgreement(meetingId, agreementId);
    
    if (!updatedMeeting) {
      res.status(404).json({
        error: 'Встреча или договоренность не найдены',
        message: 'Встреча с указанным ID не существует или договоренность не найдена'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Договоренность успешно удалена',
      data: transformMeetingResponse(updatedMeeting)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка удаления договоренности:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось удалить договоренность'
    });
  }
});

/**
 * PATCH /api/meetings/:id/agreements/status
 * Обновление статуса договоренности
 */
router.patch('/:id/agreements/status', validateUUID('id'), validateUpdateAgreementStatus, async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    const updateData = req.body;
    
    const updatedMeeting = await MeetingEntity.updateAgreementStatus(meetingId, updateData);
    
    if (!updatedMeeting) {
      res.status(404).json({
        error: 'Встреча или договоренность не найдены',
        message: 'Встреча с указанным ID не существует или договоренность не найдена'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Статус договоренности успешно обновлен',
      data: transformMeetingResponse(updatedMeeting)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка обновления статуса договоренности:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось обновить статус договоренности'
    });
  }
});

/**
 * DELETE /api/meetings/:id
 * Отмена встречи
 */
router.delete('/:id', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    
    const cancelledMeeting = await MeetingEntity.cancel(meetingId);
    
    if (!cancelledMeeting) {
      res.status(404).json({
        error: 'Встреча не найдена или не может быть отменена',
        message: 'Встреча должна иметь статус "scheduled" или "active" для отмены'
      });
      return;
    }
    
    const response: ApiResponse<MeetingResponse> = {
      success: true,
      message: 'Встреча успешно отменена',
      data: transformMeetingResponse(cancelledMeeting)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка отмены встречи:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось отменить встречу'
    });
  }
});

/**
 * GET /api/meetings/employees/:employeeId/stats
 * Получение статистики встреч по сотруднику
 */
router.get('/employees/:employeeId/stats', validateUUID('employeeId'), async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId!;
    
    const stats = await MeetingEntity.getEmployeeStats(employeeId);
    
    const response: ApiResponse = {
      success: true,
      data: stats
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения статистики сотрудника:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить статистику сотрудника'
    });
  }
});

export default router;
