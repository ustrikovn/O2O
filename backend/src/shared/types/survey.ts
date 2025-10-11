/**
 * Типы для системы опросов
 */

// Основные типы вопросов
export type QuestionType = 
  | 'single-choice'
  | 'multiple-choice' 
  | 'rating'
  | 'text'
  | 'textarea';

// Операторы для условий
export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in';

// Базовый интерфейс для условий
export interface BaseCondition {
  questionId: string;
  operator: ConditionOperator;
  value: any;
}

// Вариант ответа для вопросов с выбором
export interface QuestionOption {
  value: string;
  label: string;
  nextQuestion?: string;
}

// Настройки шкалы для rating вопросов
export interface RatingScale {
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

// Правила валидации
export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  minSelections?: number;
  maxSelections?: number;
  pattern?: string;
  custom?: string; // JSON строка с кастомными правилами
  errorMessage?: string;
}

// Условный переход
export interface ConditionalLogic {
  if: BaseCondition;
  then: {
    nextQuestion?: string;
    skip?: string[];
    end?: boolean;
  };
}

// Секция/блок опроса
export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  icon?: string; // Опциональная иконка для секции
}

// Базовый интерфейс вопроса
export interface BaseQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  section?: string; // ID секции, к которой относится вопрос
  hints?: string[]; // Подсказки/уточняющие вопросы для помощи в ответе
  tags?: string[]; // Теги для маркировки вопросов (например, 'disc:leadership', 'disc:obstacle', 'disc:difficult')
  nextQuestion?: string; // По умолчанию следующий вопрос
  conditions?: ConditionalLogic[]; // Условная логика
  validation?: ValidationRules;
}

// Вопрос с одним выбором
export interface SingleChoiceQuestion extends BaseQuestion {
  type: 'single-choice';
  options: QuestionOption[];
}

// Вопрос с множественным выбором
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice';
  options: QuestionOption[];
  minSelections?: number;
  maxSelections?: number;
}

// Вопрос с рейтингом
export interface RatingQuestion extends BaseQuestion {
  type: 'rating';
  scale: RatingScale;
}

// Текстовый вопрос
export interface TextQuestion extends BaseQuestion {
  type: 'text';
  placeholder?: string;
  maxLength?: number;
}

// Вопрос с текстовой областью
export interface TextareaQuestion extends BaseQuestion {
  type: 'textarea';
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

// Объединенный тип вопроса
export type Question = 
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | RatingQuestion
  | TextQuestion
  | TextareaQuestion;

// Логика пропуска вопросов
export interface SkipLogic {
  conditions: ConditionalLogic[];
}


// Настройки опроса
export interface SurveySettings {
  allowBack?: boolean;
  showProgress?: boolean;
  randomizeOptions?: boolean;
  savePartialResults?: boolean;
  timeLimit?: number; // в минутах
  requireCompletion?: boolean;
}

// Метаданные опроса
export interface SurveyMetadata {
  category?: string;
  estimatedDuration?: number; // в минутах
  author?: string;
  tags?: string[];
  version?: string;
  sections?: SurveySection[]; // Описание секций опроса
  createdAt?: Date;
  updatedAt?: Date;
}

// Основная структура опроса
export interface Survey {
  id: string;
  title: string;
  description?: string | undefined;
  metadata?: SurveyMetadata | undefined;
  questions: Question[];
  logic: {
    startQuestion: string;
    endPoints: string[];
    skipLogic?: SkipLogic | undefined;
  };
  settings?: SurveySettings | undefined;
  isActive?: boolean | undefined;
}

// Ответ на вопрос
export interface QuestionAnswer {
  questionId: string;
  questionType: QuestionType;
  value: any; // Может быть string, string[], number в зависимости от типа
  timestamp?: Date;
  timeTaken?: number; // время на ответ в секундах
}

// Результат опроса
export interface SurveyResult {
  id: string;
  surveyId: string;
  employeeId?: string | undefined; // ID сотрудника, если привязан к сотруднику
  meetingId?: string | undefined; // ID встречи, если проводится в рамках one-to-one
  answers: QuestionAnswer[];
  status: 'started' | 'in_progress' | 'completed' | 'abandoned';
  startedAt: Date;
  completedAt?: Date | undefined;
  metadata?: {
    userAgent?: string | undefined;
    ip?: string | undefined;
    duration?: number | undefined; // общее время прохождения в секундах
    disc?: {
      llmLabel?: 'D' | 'I' | 'S' | 'C';
      sourceQuestionId?: string | undefined;
      model?: string | undefined;
      createdAt?: string | undefined; // ISO timestamp
      rawText?: string | undefined; // Сырой ответ LLM для отладки/аудита
      byQuestionId?: Record<string, {
        traits?: Array<'D' | 'I' | 'S' | 'C'>;
        llmLabel?: 'D' | 'I' | 'S' | 'C';
        model?: string | undefined;
        createdAt?: string | undefined;
        rawText?: string | undefined; // Сырой ответ LLM для отладки/аудита
      } | undefined> | undefined;
    } | undefined;
  } | undefined;
}

// Статистика по опросу
export interface SurveyStats {
  surveyId: string;
  totalResponses: number;
  completedResponses: number;
  abandonedResponses: number;
  averageDuration?: number | undefined;
  questionStats: Array<{
    questionId: string;
    responseCount: number;
    averageTimeTaken?: number | undefined;
    valueDistribution?: Record<string, number> | undefined;
  }>;
}

// DTO для создания опроса
export interface CreateSurveyDto {
  title: string;
  description?: string;
  questions: Question[];
  logic: Survey['logic'];
  settings?: SurveySettings;
  metadata?: Omit<SurveyMetadata, 'createdAt' | 'updatedAt'>;
}

// DTO для обновления опроса
export interface UpdateSurveyDto extends Partial<CreateSurveyDto> {
  isActive?: boolean;
}

// DTO для начала прохождения опроса
export interface StartSurveyDto {
  surveyId: string;
  employeeId?: string;
  meetingId?: string;
}

// DTO для отправки ответа
export interface SubmitAnswerDto {
  resultId: string;
  questionId: string;
  value: any;
}

// DTO для завершения опроса
export interface CompleteSurveyDto {
  resultId: string;
}

// Ответ API для получения следующего вопроса
export interface NextQuestionResponse {
  question?: Question | undefined;
  isCompleted: boolean;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  } | undefined;
}

// Экспортируем все типы через export
