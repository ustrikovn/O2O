/**
 * Валидация для системы опросов
 */

import Joi from 'joi';
import { 
  CreateSurveyDto, 
  UpdateSurveyDto, 
  StartSurveyDto, 
  SubmitAnswerDto,
  QuestionType,
  ConditionOperator 
} from '../../../shared/types/survey.js';

// Схема для типов вопросов
const questionTypeSchema = Joi.string().valid(
  'single-choice',
  'multiple-choice', 
  'rating',
  'text',
  'textarea'
);

// Схема для операторов условий
const conditionOperatorSchema = Joi.string().valid(
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'contains',
  'not_contains',
  'in',
  'not_in'
);

// Схема для вариантов ответов
const optionSchema = Joi.object({
  value: Joi.string().required(),
  label: Joi.string().required(),
  nextQuestion: Joi.string().optional()
});

// Схема для настроек шкалы
const ratingScaleSchema = Joi.object({
  min: Joi.number().integer().required(),
  max: Joi.number().integer().min(Joi.ref('min')).required(),
  step: Joi.number().positive().optional(),
  minLabel: Joi.string().optional(),
  maxLabel: Joi.string().optional()
});

// Схема для правил валидации
const validationRulesSchema = Joi.object({
  required: Joi.boolean().optional(),
  minLength: Joi.number().integer().min(0).optional(),
  maxLength: Joi.number().integer().min(Joi.ref('minLength')).optional(),
  min: Joi.number().optional(),
  max: Joi.number().min(Joi.ref('min')).optional(),
  minSelections: Joi.number().integer().min(1).optional(),
  maxSelections: Joi.number().integer().min(Joi.ref('minSelections')).optional(),
  pattern: Joi.string().optional(),
  custom: Joi.string().optional(),
  errorMessage: Joi.string().optional()
});

// Схема для условий
const baseConditionSchema = Joi.object({
  questionId: Joi.string().required(),
  operator: conditionOperatorSchema.required(),
  value: Joi.any().required()
});

// Схема для условной логики
const conditionalLogicSchema = Joi.object({
  if: baseConditionSchema.required(),
  then: Joi.object({
    nextQuestion: Joi.string().optional(),
    skip: Joi.array().items(Joi.string()).optional(),
    end: Joi.boolean().optional()
  }).required()
});

// Схема для секции опроса
const surveySectionSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(500).optional(),
  icon: Joi.string().max(50).optional()
});

// Базовая схема для вопроса
const baseQuestionSchema = Joi.object({
  id: Joi.string().required(),
  type: questionTypeSchema.required(),
  title: Joi.string().min(1).max(1000).required(),
  description: Joi.string().max(2000).optional(),
  required: Joi.boolean().optional(),
  section: Joi.string().optional(), // ID секции
  hints: Joi.array().items(Joi.string().max(500)).optional(), // Подсказки
  nextQuestion: Joi.string().optional(),
  conditions: Joi.array().items(conditionalLogicSchema).optional(),
  validation: validationRulesSchema.optional()
});

// Схемы для конкретных типов вопросов
const singleChoiceQuestionSchema = baseQuestionSchema.keys({
  type: Joi.string().valid('single-choice').required(),
  options: Joi.array().items(optionSchema).min(2).required()
});

const multipleChoiceQuestionSchema = baseQuestionSchema.keys({
  type: Joi.string().valid('multiple-choice').required(),
  options: Joi.array().items(optionSchema).min(2).required(),
  minSelections: Joi.number().integer().min(1).optional(),
  maxSelections: Joi.number().integer().min(Joi.ref('minSelections')).optional()
});

const ratingQuestionSchema = baseQuestionSchema.keys({
  type: Joi.string().valid('rating').required(),
  scale: ratingScaleSchema.required()
});

const textQuestionSchema = baseQuestionSchema.keys({
  type: Joi.string().valid('text').required(),
  placeholder: Joi.string().max(200).optional(),
  maxLength: Joi.number().integer().min(1).max(10000).optional()
});

const textareaQuestionSchema = baseQuestionSchema.keys({
  type: Joi.string().valid('textarea').required(),
  placeholder: Joi.string().max(500).optional(),
  rows: Joi.number().integer().min(2).max(20).optional(),
  maxLength: Joi.number().integer().min(1).max(50000).optional()
});

// Объединенная схема для любого типа вопроса
const questionSchema = Joi.alternatives().try(
  singleChoiceQuestionSchema,
  multipleChoiceQuestionSchema,
  ratingQuestionSchema,
  textQuestionSchema,
  textareaQuestionSchema
);


// Схема для настроек опроса
const surveySettingsSchema = Joi.object({
  allowBack: Joi.boolean().optional(),
  showProgress: Joi.boolean().optional(),
  randomizeOptions: Joi.boolean().optional(),
  savePartialResults: Joi.boolean().optional(),
  timeLimit: Joi.number().integer().min(1).optional(),
  requireCompletion: Joi.boolean().optional()
});

// Схема для метаданных
const surveyMetadataSchema = Joi.object({
  category: Joi.string().max(100).optional(),
  estimatedDuration: Joi.number().integer().min(1).optional(),
  author: Joi.string().max(255).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).optional(),
  sections: Joi.array().items(surveySectionSchema).optional()
});

// Схема для логики опроса
const surveyLogicSchema = Joi.object({
  startQuestion: Joi.string().required(),
  endPoints: Joi.array().items(Joi.string()).min(1).required(),
  skipLogic: Joi.object({
    conditions: Joi.array().items(conditionalLogicSchema).optional()
  }).optional()
});

// Основные схемы валидации
export const createSurveySchema = Joi.object<CreateSurveyDto>({
  title: Joi.string().min(1).max(500).required(),
  description: Joi.string().max(2000).optional(),
  questions: Joi.array().items(questionSchema).min(1).required(),
  logic: surveyLogicSchema.required(),
  settings: surveySettingsSchema.optional(),
  metadata: surveyMetadataSchema.optional()
}).custom((value, helpers) => {
  // Кастомная валидация: проверяем связность вопросов
  const questionIds = value.questions.map((q: any) => q.id);
  const startQuestion = value.logic.startQuestion;
  const endPoints = value.logic.endPoints;

  // Проверяем, что startQuestion существует
  if (!questionIds.includes(startQuestion)) {
    return helpers.error('custom.startQuestionNotFound');
  }

  // Проверяем уникальность ID вопросов
  const uniqueIds = new Set(questionIds);
  if (uniqueIds.size !== questionIds.length) {
    return helpers.error('custom.duplicateQuestionIds');
  }

  // Проверяем ссылки на следующие вопросы
  for (const question of value.questions) {
    if (question.nextQuestion && !questionIds.includes(question.nextQuestion) && !endPoints.includes(question.nextQuestion)) {
      return helpers.error('custom.invalidNextQuestion', { questionId: question.id, nextQuestion: question.nextQuestion });
    }

    // Проверяем условную логику
    if (question.conditions) {
      for (const condition of question.conditions) {
        if (condition.then.nextQuestion && 
            !questionIds.includes(condition.then.nextQuestion) && 
            !endPoints.includes(condition.then.nextQuestion)) {
          return helpers.error('custom.invalidConditionalNextQuestion', { questionId: question.id });
        }
      }
    }

    // Проверяем nextQuestion в опциях для single-choice
    if (question.type === 'single-choice') {
      for (const option of question.options || []) {
        if (option.nextQuestion && 
            !questionIds.includes(option.nextQuestion) && 
            !endPoints.includes(option.nextQuestion)) {
          return helpers.error('custom.invalidOptionNextQuestion', { questionId: question.id, optionValue: option.value });
        }
      }
    }
  }

  return value;
}, 'Survey logic validation').messages({
  'custom.startQuestionNotFound': 'Стартовый вопрос не найден среди вопросов опроса',
  'custom.duplicateQuestionIds': 'Обнаружены дублирующиеся ID вопросов',
  'custom.invalidNextQuestion': 'Вопрос {{#questionId}} ссылается на несуществующий следующий вопрос: {{#nextQuestion}}',
  'custom.invalidConditionalNextQuestion': 'Вопрос {{#questionId}} содержит условие с ссылкой на несуществующий вопрос',
  'custom.invalidOptionNextQuestion': 'Вопрос {{#questionId}}, опция {{#optionValue}} ссылается на несуществующий вопрос'
});

export const updateSurveySchema = Joi.object<UpdateSurveyDto>({
  title: Joi.string().min(1).max(500).optional(),
  description: Joi.string().max(2000).optional(),
  questions: Joi.array().items(questionSchema).min(1).optional(),
  logic: surveyLogicSchema.optional(),
  settings: surveySettingsSchema.optional(),
  metadata: surveyMetadataSchema.optional(),
  isActive: Joi.boolean().optional()
});

export const startSurveySchema = Joi.object<StartSurveyDto>({
  surveyId: Joi.string().required(),
  employeeId: Joi.string().optional(),
  meetingId: Joi.string().optional()
});

export const submitAnswerSchema = Joi.object<SubmitAnswerDto>({
  resultId: Joi.string().required(),
  questionId: Joi.string().required(),
  value: Joi.any().required()
});

export const completeSurveySchema = Joi.object({
  resultId: Joi.string().required()
});

// Валидация ID параметров
export const idParamSchema = Joi.object({
  id: Joi.string().required()
});

export const surveyIdParamSchema = Joi.object({
  surveyId: Joi.string().required()
});

// Функции валидации
export const validateCreateSurvey = (data: any) => {
  return createSurveySchema.validate(data, { abortEarly: false });
};

export const validateUpdateSurvey = (data: any) => {
  return updateSurveySchema.validate(data, { abortEarly: false });
};

export const validateStartSurvey = (data: any) => {
  return startSurveySchema.validate(data, { abortEarly: false });
};

export const validateSubmitAnswer = (data: any) => {
  return submitAnswerSchema.validate(data, { abortEarly: false });
};

export const validateCompleteSurvey = (data: any) => {
  return completeSurveySchema.validate(data, { abortEarly: false });
};

export const validateId = (data: any) => {
  return idParamSchema.validate(data, { abortEarly: false });
};

export const validateSurveyId = (data: any) => {
  return surveyIdParamSchema.validate(data, { abortEarly: false });
};
