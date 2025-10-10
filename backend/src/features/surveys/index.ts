/**
 * Экспорт фичи surveys
 */

export { default as surveyRoutes } from './api/routes.js';
export { SurveyService } from './lib/survey-service.js';
export { SurveyRepository } from './lib/survey-repository.js';
export * from './lib/validation.js';
export * from './lib/interpreters/disc-interpreter.js';
