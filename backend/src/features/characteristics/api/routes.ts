/**
 * Routes для управления характеристиками сотрудников
 */

import express, { Request, Response } from 'express';
import { CharacteristicEntity } from '@/entities/characteristic/index.js';
import { CharacteristicGenerationService } from '@/shared/lib/characteristic-generation.js';
import { validateUUID } from '@/shared/api/middleware.js';
import { ApiResponse } from '@/shared/types/common.js';
import { query } from '@/shared/database/connection.js';

const router = express.Router();
const generationService = new CharacteristicGenerationService();

/**
 * GET /api/characteristics/:employeeId
 * Получение характеристики сотрудника
 */
router.get('/:employeeId', validateUUID('employeeId'), async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId!;
    
    const characteristic = await CharacteristicEntity.findByEmployeeId(employeeId);
    
    if (!characteristic) {
      res.status(404).json({
        success: false,
        error: 'Не найдено',
        message: 'Характеристика для этого сотрудника еще не создана'
      });
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      data: characteristic
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения характеристики:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера',
      message: 'Не удалось получить характеристику'
    });
  }
});

/**
 * POST /api/characteristics/:employeeId/generate
 * Генерация или обновление характеристики сотрудника
 */
router.post('/:employeeId/generate', validateUUID('employeeId'), async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId!;
    const { force, excludeBigFive } = req.query; // force=true для принудительной регенерации, excludeBigFive=true чтобы не учитывать Big Five в общей характеристике
    
    // Проверяем, существует ли характеристика
    const existing = await CharacteristicEntity.findByEmployeeId(employeeId);
    
    // Если не передан force: генерируем только при изменении контекста
    if (!force) {
      const { fingerprint } = await generationService.computeContextFingerprint(employeeId);
      const prevFingerprint = existing?.metadata?.generation_metadata?.context_fingerprint;
      if (existing && prevFingerprint === fingerprint) {
        res.status(200).json({
          success: true,
          message: 'Контекст не изменился, регенерация не требуется',
          data: existing
        });
        return;
      }

      // Доп. проверка для старых характеристик без отпечатка: были ли новые опросы после updated_at
      // Характеристика строится только на основе опросов DISC/BigFive
      if (existing && !prevFingerprint) {
        const since = existing.updated_at;
        // Проверяем завершённые опросы
        const surveysNewer = await query(
          `SELECT 1 FROM survey_results 
           WHERE employee_id = $1 AND status = 'completed' 
             AND completed_at > $2 
           LIMIT 1`,
          [employeeId, since]
        );

        const noChanges = surveysNewer.rows.length === 0;
        if (noChanges) {
          res.status(200).json({
            success: true,
            message: 'Контекст не изменился, регенерация не требуется',
            data: existing
          });
          return;
        }
      }
    }
    
    // Генерируем новую характеристику
    console.log(`Генерация характеристики для сотрудника ${employeeId}...`);
    const result = await generationService.generateCharacteristic(
      employeeId,
      existing?.content,
      { excludeBigFive: String(excludeBigFive || '').toLowerCase() === 'true' }
    );
    
    // Сохраняем в БД (upsert)
    const savedCharacteristic = await CharacteristicEntity.upsert(employeeId, result);
    
    const response: ApiResponse = {
      success: true,
      message: existing ? 'Характеристика обновлена' : 'Характеристика создана',
      data: savedCharacteristic
    };
    
    res.status(existing ? 200 : 201).json(response);
  } catch (error) {
    console.error('Ошибка генерации характеристики:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера',
      message: error instanceof Error ? error.message : 'Не удалось сгенерировать характеристику'
    });
  }
});

/**
 * DELETE /api/characteristics/:employeeId
 * Удаление характеристики сотрудника
 */
router.delete('/:employeeId', validateUUID('employeeId'), async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.params.employeeId!;
    
    const deleted = await CharacteristicEntity.delete(employeeId);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Не найдено',
        message: 'Характеристика не найдена'
      });
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Характеристика удалена'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка удаления характеристики:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера',
      message: 'Не удалось удалить характеристику'
    });
  }
});

/**
 * GET /api/characteristics
 * Получение всех характеристик (для администрирования)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, offset } = req.query;
    
    const options: { limit?: number; offset?: number } = {};
    if (limit) options.limit = Number(limit);
    if (offset) options.offset = Number(offset);
    
    const characteristics = await CharacteristicEntity.findAll(options);
    
    const response: ApiResponse = {
      success: true,
      data: characteristics,
      count: characteristics.length
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения характеристик:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера',
      message: 'Не удалось получить характеристики'
    });
  }
});

export default router;

