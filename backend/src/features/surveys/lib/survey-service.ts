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
import { inferDiscLabelFromOpenAnswer, inferDiscLabelForObstacle, inferDiscLabelForDifficultInteraction } from './interpreters/disc-llm.js';
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
    
    // Для закрытых вопросов (single-choice, multiple-choice) интерпретируем DISC-буквы
    const question = surveyEntity.getQuestion(data.questionId);
    if (question && (question.type === 'single-choice' || question.type === 'multiple-choice')) {
      const valueStr = String(data.value).trim();
      const valueUpper = valueStr.toUpperCase();
      
      // Маппинг для бинарных вопросов (присваивают 2 буквы)
      const binaryMapping: Record<string, string[]> = {
        'people': ['I', 'S'],      // Люди → I + S
        'tasks': ['D', 'C'],        // Задачи → D + C
        'initiator': ['D', 'I'],    // Инициатор → D + I
        'executor': ['S', 'C'],     // Исполнитель → S + C
        'fast': ['D', 'I'],         // Быстро → D + I
        'think': ['S', 'C']         // Обдумываю → S + C
      };
      
      let traits: string[] = [];
      
      // Проверяем, это прямая DISC-буква?
      if (valueUpper === 'D' || valueUpper === 'I' || valueUpper === 'S' || valueUpper === 'C') {
        traits = [valueUpper];
      }
      // Проверяем, это бинарный вопрос?
      else if (binaryMapping[valueStr.toLowerCase()]) {
        traits = binaryMapping[valueStr.toLowerCase()];
      }
      
      if (traits.length > 0) {
        // Инициализируем metadata если нужно
        if (!resultEntity.metadata) {
          resultEntity.metadata = {};
        }
        if (!resultEntity.metadata.disc) {
          resultEntity.metadata.disc = {};
        }
        if (!resultEntity.metadata.disc.byQuestionId) {
          resultEntity.metadata.disc.byQuestionId = {};
        }
        
        // Сохраняем интерпретацию (для закрытых вопросов)
        resultEntity.metadata.disc.byQuestionId[data.questionId] = {
          traits,
          model: 'rule-based',
          createdAt: new Date().toISOString()
        };
      }
    }

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
    }

    // Если опрос завершен — пробуем интерпретировать открытые ответы DISC через LLM
    if (isCompleted) {
      try {
        const leadershipQuestion = survey.questions.find(q =>
          (q.type === 'text' || q.type === 'textarea') &&
          typeof q.title === 'string' &&
          (
            q.title.includes('возглавить проект') ||
            q.title.includes('возглавить') ||
            q.title.includes('инициативу')
          )
        );

        if (leadershipQuestion) {
          const leadershipAnswer = resultEntity.getAnswer(leadershipQuestion.id);
          if (leadershipAnswer && typeof leadershipAnswer.value === 'string' && leadershipAnswer.value.trim().length > 0) {
            const { label, model } = await inferDiscLabelFromOpenAnswer(leadershipAnswer.value);
            if (!resultEntity.metadata) resultEntity.metadata = {};
            resultEntity.metadata.disc = {
              ...(resultEntity.metadata.disc || {}),
              ...(label ? { llmLabel: label } : {}),
              sourceQuestionId: leadershipQuestion.id,
              model,
              createdAt: new Date().toISOString()
            };
            // фиксируем по questionId
            resultEntity.metadata.disc.byQuestionId = {
              ...(resultEntity.metadata.disc.byQuestionId || {}),
              [leadershipQuestion.id]: {
                ...(label ? { llmLabel: label } : {}),
                model,
                createdAt: new Date().toISOString()
              }
            };
          }
        }

        // Вопрос про серьёзное препятствие
        const obstacleQuestion = survey.questions.find(q =>
          (q.type === 'text' || q.type === 'textarea') &&
          typeof q.title === 'string' &&
          (
            q.title.includes('серьёзным препятствием') ||
            q.title.includes('серьезным препятствием') ||
            q.title.includes('препятствием в работе')
          )
        );
        if (obstacleQuestion) {
          const obstacleAnswer = resultEntity.getAnswer(obstacleQuestion.id);
          if (obstacleAnswer && typeof obstacleAnswer.value === 'string' && obstacleAnswer.value.trim().length > 0) {
            const { label, model } = await inferDiscLabelForObstacle(obstacleAnswer.value);
            if (!resultEntity.metadata) resultEntity.metadata = {};
            resultEntity.metadata.disc = {
              ...(resultEntity.metadata.disc || {}),
              byQuestionId: {
                ...(resultEntity.metadata.disc?.byQuestionId || {}),
                [obstacleQuestion.id]: {
                  ...(label ? { llmLabel: label } : {}),
                  model,
                  createdAt: new Date().toISOString()
                }
              }
            };
          }
        }

        // Вопрос про трудного коллегу/клиента
        const difficultQuestion = survey.questions.find(q =>
          (q.type === 'text' || q.type === 'textarea') &&
          typeof q.title === 'string' &&
          (
            q.title.includes('трудным коллегой') ||
            q.title.includes('трудным клиентом') ||
            q.title.includes('как вы строили взаимодействие')
          )
        );
        if (difficultQuestion) {
          const difficultAnswer = resultEntity.getAnswer(difficultQuestion.id);
          if (difficultAnswer && typeof difficultAnswer.value === 'string' && difficultAnswer.value.trim().length > 0) {
            const { label, model } = await inferDiscLabelForDifficultInteraction(difficultAnswer.value);
            if (!resultEntity.metadata) resultEntity.metadata = {};
            resultEntity.metadata.disc = {
              ...(resultEntity.metadata.disc || {}),
              byQuestionId: {
                ...(resultEntity.metadata.disc?.byQuestionId || {}),
                [difficultQuestion.id]: {
                  ...(label ? { llmLabel: label } : {}),
                  model,
                  createdAt: new Date().toISOString()
                }
              }
            };
          }
        }
      } catch (llmError) {
        console.error('LLM DISC interpretation failed:', llmError);
      }
    }

    // Сохраняем обновленный результат (включая возможные metadata)
    await this.surveyRepository.updateResult(data.resultId, {
      answers: resultEntity.answers,
      status: resultEntity.status,
      completedAt: resultEntity.completedAt || undefined,
      metadata: resultEntity.metadata || undefined
    });

    const response: NextQuestionResponse = {
      question: nextQuestion || undefined,
      isCompleted,
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

    // Завершаем опрос
    resultEntity.complete();

    // Пробуем интерпретировать открытые ответы DISC через LLM при принудительном завершении
    try {
      const leadershipQuestion = survey.questions.find(q =>
        (q.type === 'text' || q.type === 'textarea') &&
        typeof q.title === 'string' &&
        (
          q.title.includes('возглавить проект') ||
          q.title.includes('возглавить') ||
          q.title.includes('инициативу')
        )
      );

      if (leadershipQuestion) {
        const leadershipAnswer = resultEntity.getAnswer(leadershipQuestion.id);
        if (leadershipAnswer && typeof leadershipAnswer.value === 'string' && leadershipAnswer.value.trim().length > 0) {
          const { label, model } = await inferDiscLabelFromOpenAnswer(leadershipAnswer.value);
          if (!resultEntity.metadata) resultEntity.metadata = {};
          resultEntity.metadata.disc = {
            ...(resultEntity.metadata.disc || {}),
            ...(label ? { llmLabel: label } : {}),
            sourceQuestionId: leadershipQuestion.id,
            model,
            createdAt: new Date().toISOString()
          };
        }
      }

      // Вопрос про серьёзное препятствие
      const obstacleQuestion = survey.questions.find(q =>
        (q.type === 'text' || q.type === 'textarea') &&
        typeof q.title === 'string' &&
        (
          q.title.includes('серьёзным препятствием') ||
          q.title.includes('серьезным препятствием') ||
          q.title.includes('препятствием в работе')
        )
      );
      if (obstacleQuestion) {
        const obstacleAnswer = resultEntity.getAnswer(obstacleQuestion.id);
        if (obstacleAnswer && typeof obstacleAnswer.value === 'string' && obstacleAnswer.value.trim().length > 0) {
          const { label, model } = await inferDiscLabelForObstacle(obstacleAnswer.value);
          if (!resultEntity.metadata) resultEntity.metadata = {};
          resultEntity.metadata.disc = {
            ...(resultEntity.metadata.disc || {}),
            byQuestionId: {
              ...(resultEntity.metadata.disc?.byQuestionId || {}),
              [obstacleQuestion.id]: {
                ...(label ? { llmLabel: label } : {}),
                model,
                createdAt: new Date().toISOString()
              }
            }
          };
        }
      }

      // Вопрос про трудного коллегу/клиента
      const difficultQuestion = survey.questions.find(q =>
        (q.type === 'text' || q.type === 'textarea') &&
        typeof q.title === 'string' &&
        (
          q.title.includes('трудным коллегой') ||
          q.title.includes('трудным клиентом') ||
          q.title.includes('как вы строили взаимодействие')
        )
      );
      if (difficultQuestion) {
        const difficultAnswer = resultEntity.getAnswer(difficultQuestion.id);
        if (difficultAnswer && typeof difficultAnswer.value === 'string' && difficultAnswer.value.trim().length > 0) {
          const { label, model } = await inferDiscLabelForDifficultInteraction(difficultAnswer.value);
          if (!resultEntity.metadata) resultEntity.metadata = {};
          resultEntity.metadata.disc = {
            ...(resultEntity.metadata.disc || {}),
            byQuestionId: {
              ...(resultEntity.metadata.disc?.byQuestionId || {}),
              [difficultQuestion.id]: {
                ...(label ? { llmLabel: label } : {}),
                model,
                createdAt: new Date().toISOString()
              }
            }
          };
        }
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
