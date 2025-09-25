/**
 * API маршруты для системы опросов
 */

import { Router } from 'express';
import { 
  validateCreateSurvey,
  validateUpdateSurvey,
  validateStartSurvey,
  validateSubmitAnswer,
  validateCompleteSurvey,
  validateId,
  validateSurveyId
} from '../lib/validation.js';
import { SurveyService } from '../lib/survey-service.js';
import { SurveyRepository } from '../lib/survey-repository.js';
import { validationMiddleware } from '../../../shared/api/middleware.js';
import { pool } from '../../../shared/database/connection.js';

const router = Router();

// Инициализируем зависимости
const surveyRepository = new SurveyRepository(pool);
const surveyService = new SurveyService(surveyRepository);

/**
 * GET /api/surveys
 * Получить список активных опросов
 */
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const surveys = await surveyService.getActiveSurveys(category as string);
    
    res.json({
      success: true,
      data: surveys,
      count: surveys.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/surveys/:id
 * Получить опрос по ID
 */
router.get('/:id', validationMiddleware(validateId, 'params'), async (req, res, next) => {
  try {
    const survey = await surveyService.getSurvey(req.params.id!);
    
    res.json({
      success: true,
      data: survey
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/surveys
 * Создать новый опрос
 */
router.post('/', validationMiddleware(validateCreateSurvey, 'body'), async (req, res, next) => {
  try {
    const survey = await surveyService.createSurvey(req.body);
    
    res.status(201).json({
      success: true,
      data: survey,
      message: 'Опрос успешно создан'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/surveys/:id
 * Обновить опрос
 */
router.put('/:id', 
  validationMiddleware(validateId, 'params'),
  validationMiddleware(validateUpdateSurvey, 'body'),
  async (req, res, next) => {
    try {
      const survey = await surveyService.updateSurvey(req.params.id!, req.body);
      
      res.json({
        success: true,
        data: survey,
        message: 'Опрос успешно обновлен'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/surveys/:id
 * Удалить опрос
 */
router.delete('/:id', validationMiddleware(validateId, 'params'), async (req, res, next) => {
  try {
    await surveyService.deleteSurvey(req.params.id!);
    
    res.json({
      success: true,
      message: 'Опрос успешно удален'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/surveys/:id/deactivate
 * Деактивировать опрос
 */
router.post('/:id/deactivate', validationMiddleware(validateId, 'params'), async (req, res, next) => {
  try {
    await surveyService.deactivateSurvey(req.params.id!);
    
    res.json({
      success: true,
      message: 'Опрос деактивирован'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/surveys/:id/statistics
 * Получить статистику по опросу
 */
router.get('/:id/statistics', validationMiddleware(validateId, 'params'), async (req, res, next) => {
  try {
    const statistics = await surveyService.getSurveyStatistics(req.params.id!);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/surveys/:id/results
 * Получить результаты опроса
 */
router.get('/:id/results', validationMiddleware(validateId, 'params'), async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const results = await surveyService.getSurveyResults(
      req.params.id!,
      status as any,
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    res.json({
      success: true,
      data: results.results,
      total: results.total,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: results.total > parseInt(offset as string) + results.results.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/surveys/start
 * Начать прохождение опроса
 */
router.post('/start', validationMiddleware(validateStartSurvey, 'body'), async (req, res, next) => {
  try {
    const result = await surveyService.startSurvey(req.body);
    
    res.status(201).json({
      success: true,
      data: {
        resultId: result.resultId,
        ...result.firstQuestion
      },
      message: 'Опрос начат'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/surveys/answer
 * Отправить ответ на вопрос
 */
router.post('/answer', validationMiddleware(validateSubmitAnswer, 'body'), async (req, res, next) => {
  try {
    const result = await surveyService.submitAnswer(req.body);
    
    res.json({
      success: true,
      data: result,
      message: result.isCompleted ? 'Опрос завершен' : 'Ответ принят'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/surveys/complete
 * Завершить опрос принудительно
 */
router.post('/complete', validationMiddleware(validateCompleteSurvey, 'body'), async (req, res, next) => {
  try {
    const result = await surveyService.completeSurvey(req.body.resultId);
    
    res.json({
      success: true,
      data: result,
      message: 'Опрос завершен'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/surveys/results/:resultId
 * Получить результат опроса
 */
router.get('/results/:resultId', async (req, res, next) => {
  try {
    const result = await surveyService.getSurveyResult(req.params.resultId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/surveys/results/:resultId/resume
 * Восстановить незавершенный опрос
 */
router.post('/results/:resultId/resume', async (req, res, next) => {
  try {
    const result = await surveyService.resumeSurvey(req.params.resultId);
    
    res.json({
      success: true,
      data: result,
      message: 'Опрос восстановлен'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/surveys/employees/:employeeId/results
 * Получить результаты опросов для сотрудника
 */
router.get('/employees/:employeeId/results', async (req, res, next) => {
  try {
    const { surveyId } = req.query;
    const results = await surveyService.getEmployeeResults(
      req.params.employeeId,
      surveyId as string
    );
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/surveys/meetings/:meetingId/results
 * Получить результаты опросов для встречи
 */
router.get('/meetings/:meetingId/results', async (req, res, next) => {
  try {
    const results = await surveyService.getMeetingResults(req.params.meetingId);
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/surveys/maintenance/cleanup-abandoned
 * Очистка заброшенных опросов (служебный endpoint)
 */
router.post('/maintenance/cleanup-abandoned', async (req, res, next) => {
  try {
    const { hours = 24 } = req.body;
    const abandonedResults = await surveyService.findAbandonedResults(hours);
    
    // Отмечаем как заброшенные
    for (const result of abandonedResults) {
      await surveyService.markAsAbandoned(result.id);
    }
    
    res.json({
      success: true,
      data: {
        cleanedUp: abandonedResults.length,
        results: abandonedResults.map(r => ({ id: r.id, surveyId: r.surveyId, startedAt: r.startedAt }))
      },
      message: `Очищено ${abandonedResults.length} заброшенных результатов`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
