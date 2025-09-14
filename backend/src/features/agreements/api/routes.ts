import { Router, Request, Response } from 'express';
import { AgreementEntity, CreateAgreementDto, UpdateAgreementStatusDto } from '../../../entities/agreement/model/agreement.js';
import { validateUUID } from '../../../shared/api/middleware.js';
import { ApiResponse } from '../../../shared/types/common.js';
import { validateCreateAgreement, validateUpdateAgreementStatus } from '../lib/validation.js';

const router = Router();

/**
 * GET /api/employees/:id/agreements/open
 * Получение всех открытых договоренностей для сотрудника
 */
router.get('/employees/:id/agreements/open', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.id!;
    
    const agreements = await AgreementEntity.getOpenByEmployeeId(employeeId);
    
    const response: ApiResponse<{ agreements: typeof agreements }> = {
      success: true,
      message: `Найдено ${agreements.length} открытых договоренностей`,
      data: { agreements }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения открытых договоренностей:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить договоренности'
    });
  }
});

/**
 * GET /api/meetings/:id/agreements
 * Получение договоренностей конкретной встречи
 */
router.get('/meetings/:id/agreements', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.id!;
    
    const agreements = await AgreementEntity.getByMeetingId(meetingId);
    
    const response: ApiResponse<{ agreements: typeof agreements }> = {
      success: true,
      message: `Найдено ${agreements.length} договоренностей для встречи`,
      data: { agreements }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения договоренностей встречи:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить договоренности встречи'
    });
  }
});

/**
 * POST /api/agreements
 * Создание новой договоренности
 */
router.post('/agreements', validateCreateAgreement, async (req: Request, res: Response): Promise<void> => {
  try {
    const agreementData: CreateAgreementDto = req.body;
    
    const newAgreement = await AgreementEntity.create(agreementData);
    
    if (!newAgreement) {
      res.status(500).json({
        error: 'Ошибка создания',
        message: 'Не удалось создать договоренность'
      });
      return;
    }
    
    const response: ApiResponse<typeof newAgreement> = {
      success: true,
      message: 'Договоренность успешно создана',
      data: newAgreement
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Ошибка создания договоренности:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось создать договоренность'
    });
  }
});

/**
 * PATCH /api/agreements/:id/status
 * Обновление статуса договоренности
 */
router.patch('/agreements/:id/status', validateUUID('id'), validateUpdateAgreementStatus, async (req: Request, res: Response): Promise<void> => {
  try {
    const agreementId = req.params.id!;
    const { status } = req.body;
    
    const updatedAgreement = await AgreementEntity.updateStatus(agreementId, status);
    
    if (!updatedAgreement) {
      res.status(404).json({
        error: 'Не найдено',
        message: 'Договоренность с указанным ID не найдена'
      });
      return;
    }
    
    const response: ApiResponse<typeof updatedAgreement> = {
      success: true,
      message: 'Статус договоренности успешно обновлен',
      data: updatedAgreement
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
 * GET /api/employees/:id/agreements/stats
 * Статистика по договоренностям сотрудника
 */
router.get('/employees/:id/agreements/stats', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.id!;
    
    const stats = await AgreementEntity.getEmployeeStats(employeeId);
    
    const response: ApiResponse<typeof stats> = {
      success: true,
      message: 'Статистика получена',
      data: stats
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения статистики договоренностей:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить статистику'
    });
  }
});

export default router;
