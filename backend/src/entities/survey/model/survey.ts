/**
 * Модель сущности Survey
 */

import { Survey, SurveyResult, Question, QuestionAnswer } from '../../../shared/types/survey.js';

export class SurveyEntity implements Survey {
  id: string;
  title: string;
  description?: string | undefined;
  metadata?: Survey['metadata'] | undefined;
  questions: Question[];
  logic: Survey['logic'];
  settings?: Survey['settings'] | undefined;
  isActive?: boolean | undefined;

  constructor(data: Survey) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.metadata = data.metadata;
    this.questions = data.questions;
    this.logic = data.logic;
    this.settings = data.settings;
    this.isActive = data.isActive ?? true;
  }

  /**
   * Получить первый вопрос опроса
   */
  getStartQuestion(): Question | null {
    return this.questions.find(q => q.id === this.logic.startQuestion) || null;
  }

  /**
   * Получить вопрос по ID
   */
  getQuestion(questionId: string): Question | null {
    return this.questions.find(q => q.id === questionId) || null;
  }

  /**
   * Получить следующий вопрос на основе текущего ответа
   */
  getNextQuestion(
    currentQuestionId: string,
    answer: any,
    allAnswers: QuestionAnswer[] = []
  ): Question | null {
    console.log(`🔄 getNextQuestion: ${currentQuestionId}, ответ:`, answer);
    const currentQuestion = this.getQuestion(currentQuestionId);
    if (!currentQuestion) {
      console.log(`❌ Текущий вопрос ${currentQuestionId} не найден`);
      return null;
    }

    // Проверяем условную логику
    if (currentQuestion.conditions) {
      console.log(`🧠 Проверяем условную логику для ${currentQuestionId}`);
      for (const condition of currentQuestion.conditions) {
        const conditionMet = this.evaluateCondition(condition.if, answer, allAnswers);
        console.log(`🎲 Условие ${JSON.stringify(condition.if)} = ${conditionMet}`);
        if (conditionMet) {
          if (condition.then.end) {
            console.log(`🏁 Условие указывает на завершение опроса`);
            return null; // Завершение опроса
          }
          if (condition.then.nextQuestion) {
            console.log(`➡️ Условие указывает на вопрос: ${condition.then.nextQuestion}`);
            return this.getQuestion(condition.then.nextQuestion);
          }
        }
      }
    }

    // Для single-choice вопросов проверяем nextQuestion в опциях
    if (currentQuestion.type === 'single-choice') {
      console.log(`🔘 Проверяем опции single-choice для значения: ${answer}`);
      const selectedOption = currentQuestion.options.find(opt => opt.value === answer);
      if (selectedOption?.nextQuestion) {
        console.log(`➡️ Опция указывает на вопрос: ${selectedOption.nextQuestion}`);
        return this.getQuestion(selectedOption.nextQuestion);
      }
    }

    // Если есть nextQuestion по умолчанию
    if (currentQuestion.nextQuestion) {
      console.log(`➡️ Переход по умолчанию на: ${currentQuestion.nextQuestion}`);
      return this.getQuestion(currentQuestion.nextQuestion);
    }

    // Получаем следующий вопрос по порядку
    const currentIndex = this.questions.findIndex(q => q.id === currentQuestionId);
    if (currentIndex >= 0 && currentIndex < this.questions.length - 1) {
      const nextQuestion = this.questions[currentIndex + 1];
      console.log(`➡️ Переход к следующему по порядку: ${nextQuestion?.id}`);
      return nextQuestion || null;
    }

    console.log(`🏁 Достигнут конец опроса`);
    return null; // Конец опроса
  }

  /**
   * Проверить, завершен ли опрос
   */
  isCompleted(currentQuestionId: string, answers: QuestionAnswer[]): boolean {
    return this.logic.endPoints.includes(currentQuestionId) || 
           this.getNextQuestion(currentQuestionId, answers[answers.length - 1]?.value, answers) === null;
  }


  /**
   * Вычислить прогресс прохождения
   */
  calculateProgress(answers: QuestionAnswer[]): { current: number; total: number; percentage: number } {
    // Для опросов с ветвлениями используем оценочный прогресс
    // Считаем что средний путь составляет 60% от всех вопросов
    const totalQuestions = this.questions.length;
    const estimatedPath = Math.max(3, Math.ceil(totalQuestions * 0.6));
    
    const current = answers.length;
    const total = Math.max(current + 1, estimatedPath); // Минимум текущий + 1
    const percentage = Math.min(95, Math.round((current / total) * 100)); // Максимум 95% до завершения

    return { current, total, percentage };
  }

  /**
   * Валидировать ответ на вопрос
   */
  validateAnswer(questionId: string, value: any): { isValid: boolean; errors: string[] } {
    const question = this.getQuestion(questionId);
    if (!question) {
      return { isValid: false, errors: ['Вопрос не найден'] };
    }

    const errors: string[] = [];

    // Обязательное поле
    if (question.validation?.required && (value === null || value === undefined || value === '')) {
      errors.push(question.validation.errorMessage || 'Поле обязательно для заполнения');
      return { isValid: false, errors };
    }

    // Валидация в зависимости от типа вопроса
    switch (question.type) {
      case 'single-choice':
        if (value && !question.options.some(opt => opt.value === value)) {
          errors.push('Недопустимое значение');
        }
        break;

      case 'multiple-choice':
        if (Array.isArray(value)) {
          const validValues = question.options.map(opt => opt.value);
          const invalidValues = value.filter(v => !validValues.includes(v));
          if (invalidValues.length > 0) {
            errors.push('Некоторые выбранные значения недопустимы');
          }

          if (question.validation?.minSelections && value.length < question.validation.minSelections) {
            errors.push(`Минимальное количество выборов: ${question.validation.minSelections}`);
          }

          if (question.validation?.maxSelections && value.length > question.validation.maxSelections) {
            errors.push(`Максимальное количество выборов: ${question.validation.maxSelections}`);
          }
        } else if (value !== null && value !== undefined) {
          errors.push('Ожидается массив значений');
        }
        break;

      case 'rating':
        if (typeof value === 'number') {
          if (value < question.scale.min || value > question.scale.max) {
            errors.push(`Значение должно быть от ${question.scale.min} до ${question.scale.max}`);
          }
        } else if (value !== null && value !== undefined) {
          errors.push('Ожидается числовое значение');
        }
        break;

      case 'text':
      case 'textarea':
        if (typeof value === 'string') {
          if (question.validation?.minLength && value.length < question.validation.minLength) {
            errors.push(`Минимальная длина: ${question.validation.minLength} символов`);
          }
          if (question.validation?.maxLength && value.length > question.validation.maxLength) {
            errors.push(`Максимальная длина: ${question.validation.maxLength} символов`);
          }
          if (question.validation?.pattern) {
            const regex = new RegExp(question.validation.pattern);
            if (!regex.test(value)) {
              errors.push(question.validation.errorMessage || 'Неверный формат');
            }
          }
        } else if (value !== null && value !== undefined) {
          errors.push('Ожидается строковое значение');
        }
        break;
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Приватный метод для вычисления условий
   */
  private evaluateCondition(
    condition: any,
    currentValue: any,
    allAnswers: QuestionAnswer[]
  ): boolean {
    let valueToCheck = currentValue;

    // Если условие ссылается на другой вопрос
    if (condition.questionId) {
      const targetAnswer = allAnswers.find(a => a.questionId === condition.questionId);
      valueToCheck = targetAnswer?.value;
    }

    if (valueToCheck === null || valueToCheck === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        return valueToCheck === condition.value;
      case 'not_equals':
        return valueToCheck !== condition.value;
      case 'greater_than':
        return Number(valueToCheck) > Number(condition.value);
      case 'less_than':
        return Number(valueToCheck) < Number(condition.value);
      case 'greater_or_equal':
        return Number(valueToCheck) >= Number(condition.value);
      case 'less_or_equal':
        return Number(valueToCheck) <= Number(condition.value);
      case 'contains':
        return String(valueToCheck).includes(String(condition.value));
      case 'not_contains':
        return !String(valueToCheck).includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(valueToCheck);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(valueToCheck);
      default:
        return false;
    }
  }
}

export class SurveyResultEntity implements SurveyResult {
  id: string;
  surveyId: string;
  employeeId?: string | undefined;
  meetingId?: string | undefined;
  answers: QuestionAnswer[];
  status: SurveyResult['status'];
  startedAt: Date;
  completedAt?: Date | undefined;
  metadata?: SurveyResult['metadata'] | undefined;

  constructor(data: SurveyResult) {
    this.id = data.id;
    this.surveyId = data.surveyId;
    this.employeeId = data.employeeId || undefined;
    this.meetingId = data.meetingId || undefined;
    this.answers = data.answers || [];
    this.status = data.status;
    this.startedAt = data.startedAt;
    this.completedAt = data.completedAt || undefined;
    this.metadata = data.metadata || undefined;
  }

  /**
   * Добавить ответ
   */
  addAnswer(answer: QuestionAnswer): void {
    // Удаляем предыдущий ответ на тот же вопрос, если есть
    this.answers = this.answers.filter(a => a.questionId !== answer.questionId);
    this.answers.push({
      ...answer,
      timestamp: answer.timestamp || new Date()
    });
    
    this.status = 'in_progress';
  }

  /**
   * Завершить опрос
   */
  complete(): void {
    this.status = 'completed';
    this.completedAt = new Date();
    
    // Обновляем метаданные
    if (!this.metadata) this.metadata = {};
    this.metadata.duration = Math.round(
      (this.completedAt.getTime() - this.startedAt.getTime()) / 1000
    );
  }

  /**
   * Получить последний ответ
   */
  getLastAnswer(): QuestionAnswer | null {
    return this.answers.length > 0 ? (this.answers[this.answers.length - 1] || null) : null;
  }

  /**
   * Получить ответ на конкретный вопрос
   */
  getAnswer(questionId: string): QuestionAnswer | null {
    return this.answers.find(a => a.questionId === questionId) || null;
  }

  /**
   * Проверить, отвечен ли вопрос
   */
  hasAnswered(questionId: string): boolean {
    return this.answers.some(a => a.questionId === questionId);
  }
}
