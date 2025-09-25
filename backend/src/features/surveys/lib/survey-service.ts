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
      scoring: data.scoring || undefined,
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
    
    let profile: string | undefined;
    let score: number | undefined;

    if (isCompleted) {
      // НЕ ВЫЧИСЛЯЕМ профиль и балл автоматически
      // Это будет делаться отдельной функцией интерпретации
      
      // Завершаем опрос БЕЗ профиля и оценки
      resultEntity.complete(undefined, undefined);
    }

    // Сохраняем обновленный результат
    await this.surveyRepository.updateResult(data.resultId, {
      answers: resultEntity.answers,
      status: resultEntity.status,
      profile: resultEntity.profile || undefined,
      score: resultEntity.score || undefined,
      completedAt: resultEntity.completedAt || undefined
    });

    const response: NextQuestionResponse = {
      question: nextQuestion || undefined,
      isCompleted,
      profile,
      score,
      progress: surveyEntity.calculateProgress(resultEntity.answers)
    };

    return response;
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

    // НЕ ВЫЧИСЛЯЕМ профиль и балл автоматически
    // Интерпретация будет делаться отдельно
    
    // Завершаем опрос БЕЗ профиля и оценки
    resultEntity.complete(undefined, undefined);

    // Сохраняем результат
    await this.surveyRepository.updateResult(resultId, {
      status: resultEntity.status,
      profile: resultEntity.profile || undefined,
      score: resultEntity.score || undefined,
      completedAt: resultEntity.completedAt || undefined
    });

    return {
      question: undefined,
      isCompleted: true,
      profile: resultEntity.profile,
      score: resultEntity.score,
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
