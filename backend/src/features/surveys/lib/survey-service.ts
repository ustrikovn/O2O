/**
 * Сервис для работы с опросами
 */

import { randomUUID } from 'crypto';
import { 
  Survey, 
  SurveyResult, 
  CreateSurveyDto, 
  UpdateSurveyDto,
  StartSurveyDto,
  SubmitAnswerDto,
  NextQuestionResponse,
  SurveyStats,
  QuestionAnswer
} from '../../../shared/types/survey.js';
import { SurveyEntity, SurveyResultEntity } from '../../../entities/survey/index.js';
import { runDiscLLMForResult } from './interpreters/disc-service.js';
import { runBigFiveSummaryForResult } from './interpreters/bigfive-service.js';
import { SurveyRepository } from './survey-repository.js';
import { ApiError } from '../../../shared/api/middleware.js';

export class SurveyService {
  private surveyRepository: SurveyRepository;

  constructor(surveyRepository: SurveyRepository) {
    this.surveyRepository = surveyRepository;
  }

  /**
   * Создать новый опрос
   */
  async createSurvey(data: CreateSurveyDto): Promise<Survey> {
    const surveyId = randomUUID();
    
    const survey: Survey = {
      id: surveyId,
      title: data.title,
      description: data.description || undefined,
      questions: data.questions,
      logic: data.logic,
      settings: data.settings || undefined,
      metadata: {
        ...data.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      isActive: true
    };

    // Валидируем опрос через entity
    const surveyEntity = new SurveyEntity(survey);
    
    // Проверяем, что стартовый вопрос существует
    const startQuestion = surveyEntity.getStartQuestion();
    if (!startQuestion) {
      throw new ApiError(400, 'Стартовый вопрос не найден');
    }

    return await this.surveyRepository.create(survey);
  }

  /**
   * Получить опрос по ID
   */
  async getSurvey(id: string): Promise<Survey> {
    const survey = await this.surveyRepository.findById(id);
    if (!survey) {
      throw new ApiError(404, 'Опрос не найден');
    }
    return survey;
  }

  /**
   * Получить активные опросы
   */
  async getActiveSurveys(category?: string): Promise<Survey[]> {
    return await this.surveyRepository.findActive(category);
  }

  /**
   * Обновить опрос
   */
  async updateSurvey(id: string, data: UpdateSurveyDto): Promise<Survey> {
    const existingSurvey = await this.getSurvey(id);
    
    const updatedSurvey: Survey = {
      ...existingSurvey,
      ...data,
      metadata: {
        ...existingSurvey.metadata,
        ...data.metadata,
        updatedAt: new Date()
      }
    };

    // Валидируем обновленный опрос
    const surveyEntity = new SurveyEntity(updatedSurvey);
    if (updatedSurvey.questions && updatedSurvey.logic) {
      const startQuestion = surveyEntity.getStartQuestion();
      if (!startQuestion) {
        throw new ApiError(400, 'Стартовый вопрос не найден в обновленном опросе');
      }
    }

    return await this.surveyRepository.update(id, updatedSurvey);
  }

  /**
   * Деактивировать опрос
   */
  async deactivateSurvey(id: string): Promise<void> {
    await this.getSurvey(id); // Проверяем существование
    await this.surveyRepository.update(id, { isActive: false });
  }

  /**
   * Удалить опрос
   */
  async deleteSurvey(id: string): Promise<void> {
    await this.getSurvey(id); // Проверяем существование
    await this.surveyRepository.delete(id);
  }

  /**
   * Начать прохождение опроса
   */
  async startSurvey(data: StartSurveyDto): Promise<{ resultId: string; firstQuestion: NextQuestionResponse }> {
    const survey = await this.getSurvey(data.surveyId);
    if (!survey.isActive) {
      throw new ApiError(400, 'Опрос не активен');
    }

    const surveyEntity = new SurveyEntity(survey);
    const firstQuestion = surveyEntity.getStartQuestion();
    
    if (!firstQuestion) {
      throw new ApiError(500, 'Не удалось получить первый вопрос опроса');
    }

    const resultId = randomUUID();
    const result: SurveyResult = {
      id: resultId,
      surveyId: data.surveyId,
      employeeId: data.employeeId || undefined,
      meetingId: data.meetingId || undefined,
      answers: [],
      status: 'started',
      startedAt: new Date()
    };

    await this.surveyRepository.createResult(result);

    const response: NextQuestionResponse = {
      question: firstQuestion,
      isCompleted: false,
      progress: surveyEntity.calculateProgress([])
    };

    return { resultId, firstQuestion: response };
  }

  /**
   * Отправить ответ на вопрос
   */
  async submitAnswer(data: SubmitAnswerDto): Promise<NextQuestionResponse> {
    const result = await this.surveyRepository.findResultById(data.resultId);
    if (!result) {
      throw new ApiError(404, 'Результат опроса не найден');
    }

    if (result.status === 'completed') {
      throw new ApiError(400, 'Опрос уже завершен');
    }

    const survey = await this.getSurvey(result.surveyId);
    const surveyEntity = new SurveyEntity(survey);
    const resultEntity = new SurveyResultEntity(result);

    // Валидируем ответ
    const validation = surveyEntity.validateAnswer(data.questionId, data.value);
    if (!validation.isValid) {
      throw new ApiError(400, validation.errors.join(', '));
    }

    // Создаем объект ответа
    const answer: QuestionAnswer = {
      questionId: data.questionId,
      questionType: surveyEntity.getQuestion(data.questionId)!.type,
      value: data.value,
      timestamp: new Date()
    };

    // Добавляем ответ
    resultEntity.addAnswer(answer);
    
    // Закрытые вопросы больше не интерпретируются на бэкенде —
    // фронт передает финальные значения (одна или две буквы),
    // бэкенд только сохраняет ответ как есть.

    // Определяем следующий вопрос
    console.log(`🔍 Определяем следующий вопрос после ${data.questionId} с ответом:`, data.value);
    const nextQuestion = surveyEntity.getNextQuestion(
      data.questionId, 
      data.value, 
      resultEntity.answers
    );
    console.log(`🎯 Следующий вопрос:`, nextQuestion?.id || 'null (завершение)');

    // Проверяем завершение опроса
    const isCompleted = !nextQuestion || surveyEntity.isCompleted(data.questionId, resultEntity.answers);
    console.log(`✅ Опрос завершен:`, isCompleted);
    
    if (isCompleted) {
      // Завершаем опрос
      resultEntity.complete();
      
      // Устанавливаем флаг, что LLM обработка еще не началась
      if (!resultEntity.metadata) {
        resultEntity.metadata = {};
      }
      resultEntity.metadata.llmProcessing = 'pending';
    }

    // Сохраняем обновленный результат СРАЗУ (без ожидания LLM)
    await this.surveyRepository.updateResult(data.resultId, {
      answers: resultEntity.answers,
      status: resultEntity.status,
      completedAt: resultEntity.completedAt || undefined,
      metadata: resultEntity.metadata || undefined
    });

    // Если опрос завершен — запускаем обработку (Big Five summary) и LLM DISC асинхронно
    if (isCompleted) {
      // Запускаем обработку в фоне без await
      this.processLLMInBackground(data.resultId, survey, resultEntity).catch(error => {
        console.error('Background LLM processing failed:', error);
      });
    }

    const response: NextQuestionResponse = {
      question: nextQuestion || undefined,
      isCompleted,
      progress: surveyEntity.calculateProgress(resultEntity.answers)
    };

    return response;
  }

  /**
   * Фоновая обработка LLM для результата опроса
   */
  private async processLLMInBackground(resultId: string, survey: Survey, resultEntity: SurveyResultEntity): Promise<void> {
    try {
      console.log(`🤖 Начинаем фоновую LLM обработку для результата ${resultId}`);
      
      // Обновляем статус на "в процессе"
      await this.surveyRepository.updateResult(resultId, {
        metadata: { ...resultEntity.metadata, llmProcessing: 'in_progress' }
      });
      
      // Определяем типы опросов по тэгам/ID вопросов
      const isBigFiveSurvey = (
        Array.isArray(survey?.metadata?.tags) && survey.metadata!.tags!.includes('big-five')
      ) || survey.questions.some(q => ['op','co','ex','ag','ne'].some(prefix => String(q.id || '').startsWith(prefix)));
      const isDiscSurvey = survey.questions.some(q => Array.isArray(q.tags) && q.tags!.some(t => String(t).startsWith('disc:')));

      // 1) Считаем Big Five summary ТОЛЬКО для Big Five опросов
      if (isBigFiveSurvey) {
        try {
          await runBigFiveSummaryForResult({ survey, resultEntity });
        } catch (e) {
          console.error('Big Five summary failed:', e);
        }
      }

      // 2) Сохраняем промежуточные метаданные (bigFive)
      await this.surveyRepository.updateResult(resultId, {
        metadata: { ...resultEntity.metadata }
      });

      // 3) Выполняем LLM обработку DISC ТОЛЬКО для DISC-опросов
      if (isDiscSurvey) {
        await runDiscLLMForResult({ survey, resultEntity });
      }
      
      // Обновляем результат с данными LLM и статусом "завершено"
      await this.surveyRepository.updateResult(resultId, {
        metadata: { ...resultEntity.metadata, llmProcessing: 'completed' }
      });
      
      console.log(`✅ Фоновая LLM обработка завершена для результата ${resultId}`);
      
      // Автоматически обновляем характеристику сотрудника после завершения обработки опроса
      if (resultEntity.employeeId) {
        const { autoUpdateCharacteristicAsync } = await import('@/shared/lib/characteristic-auto-update.js');
        autoUpdateCharacteristicAsync(resultEntity.employeeId);
      }
    } catch (error) {
      console.error(`❌ Ошибка фоновой LLM обработки для результата ${resultId}:`, error);
      
      // Обновляем статус на "ошибка"
      await this.surveyRepository.updateResult(resultId, {
        metadata: { ...resultEntity.metadata, llmProcessing: 'failed', llmError: String(error) }
      });
    }
  }

  /**
   * Принудительно завершить опрос
   */
  async completeSurvey(resultId: string): Promise<NextQuestionResponse> {
    const result = await this.surveyRepository.findResultById(resultId);
    if (!result) {
      throw new ApiError(404, 'Результат опроса не найден');
    }

    if (result.status === 'completed') {
      throw new ApiError(400, 'Опрос уже завершен');
    }

    const survey = await this.getSurvey(result.surveyId);
    const surveyEntity = new SurveyEntity(survey);
    const resultEntity = new SurveyResultEntity(result);

    // Завершаем опрос
    resultEntity.complete();

    // Пробуем интерпретировать открытые ответы DISC через LLM при принудительном завершении
    try {
      const isDiscSurvey = survey.questions.some(q => Array.isArray(q.tags) && q.tags!.some(t => String(t).startsWith('disc:')));
      if (isDiscSurvey) {
        await runDiscLLMForResult({ survey, resultEntity });
      }
    } catch (llmError) {
      console.error('LLM DISC interpretation failed (complete):', llmError);
    }

    // Сохраняем результат
    await this.surveyRepository.updateResult(resultId, {
      status: resultEntity.status,
      completedAt: resultEntity.completedAt || undefined,
      metadata: resultEntity.metadata || undefined
    });

    return {
      question: undefined,
      isCompleted: true,
      progress: surveyEntity.calculateProgress(resultEntity.answers)
    };
  }

  /**
   * Получить результат опроса
   */
  async getSurveyResult(resultId: string): Promise<SurveyResult> {
    const result = await this.surveyRepository.findResultById(resultId);
    if (!result) {
      throw new ApiError(404, 'Результат опроса не найден');
    }
    return result;
  }

  /**
   * Получить результаты опроса для сотрудника
   */
  async getEmployeeResults(employeeId: string, surveyId?: string): Promise<SurveyResult[]> {
    return await this.surveyRepository.findResultsByEmployee(employeeId, surveyId);
  }

  /**
   * Получить результаты опроса для встречи
   */
  async getMeetingResults(meetingId: string): Promise<SurveyResult[]> {
    return await this.surveyRepository.findResultsByMeeting(meetingId);
  }

  /**
   * Получить статистику по опросу
   */
  async getSurveyStatistics(surveyId: string): Promise<SurveyStats> {
    await this.getSurvey(surveyId); // Проверяем существование опроса
    return await this.surveyRepository.getStatistics(surveyId);
  }

  /**
   * Получить все результаты опроса
   */
  async getSurveyResults(
    surveyId: string, 
    status?: SurveyResult['status'],
    limit?: number,
    offset?: number
  ): Promise<{ results: SurveyResult[]; total: number }> {
    await this.getSurvey(surveyId); // Проверяем существование опроса
    return await this.surveyRepository.findResultsBySurvey(surveyId, status, limit, offset);
  }

  /**
   * Найти незавершенные опросы для очистки
   */
  async findAbandonedResults(olderThanHours: number = 24): Promise<SurveyResult[]> {
    return await this.surveyRepository.findAbandonedResults(olderThanHours);
  }

  /**
   * Отметить результат как заброшенный
   */
  async markAsAbandoned(resultId: string): Promise<void> {
    const result = await this.getSurveyResult(resultId);
    if (result.status !== 'completed') {
      await this.surveyRepository.updateResult(resultId, { 
        status: 'abandoned' 
      });
    }
  }

  /**
   * Восстановить состояние незавершенного опроса
   */
  async resumeSurvey(resultId: string): Promise<NextQuestionResponse> {
    const result = await this.getSurveyResult(resultId);
    
    if (result.status === 'completed') {
      throw new ApiError(400, 'Опрос уже завершен');
    }

    if (result.status === 'abandoned') {
      throw new ApiError(400, 'Опрос был отменен');
    }

    const survey = await this.getSurvey(result.surveyId);
    const surveyEntity = new SurveyEntity(survey);

    // Определяем текущий вопрос
    let currentQuestion: any = null;
    
    if (result.answers.length === 0) {
      // Если нет ответов, возвращаем первый вопрос
      currentQuestion = surveyEntity.getStartQuestion();
    } else {
      // Получаем следующий вопрос после последнего ответа
      const lastAnswer = result.answers[result.answers.length - 1];
      if (lastAnswer) {
        currentQuestion = surveyEntity.getNextQuestion(
          lastAnswer.questionId,
          lastAnswer.value,
          result.answers
        );
      }
    }

    const isCompleted = !currentQuestion;

    return {
      question: currentQuestion || undefined,
      isCompleted,
      progress: surveyEntity.calculateProgress(result.answers)
    };
  }
}
