/**
 * Упрощенная валидация данных для встреч
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/shared/types/common.js';

/**
 * Валидация данных для создания встречи
 */
export function validateCreateMeeting(req: Request, res: Response, next: NextFunction): void {
  const { employeeId } = req.body;
  const errors: string[] = [];

  // Проверка employeeId
  if (!employeeId) {
    errors.push('Employee ID is required');
  } else if (typeof employeeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
    errors.push('Employee ID must be a valid UUID');
  }

  if (errors.length > 0) {
    const response: ApiError = {
      error: 'Validation error',
      message: 'Invalid meeting data',
      details: errors.map(error => ({ field: 'general', message: error }))
    };
    res.status(400).json(response);
    return;
  }

  next();
}

/**
 * Валидация данных для обновления заметок
 */
export function validateUpdateNotes(req: Request, res: Response, next: NextFunction): void {
  const { notes } = req.body;
  const errors: string[] = [];

  // Проверка notes
  if (!notes) {
    errors.push('Notes content is required');
  } else if (typeof notes !== 'string' || notes.trim().length === 0) {
    errors.push('Notes must be a non-empty string');
  }

  if (errors.length > 0) {
    const response: ApiError = {
      error: 'Validation error',
      message: 'Invalid notes data',
      details: errors.map(error => ({ field: 'general', message: error }))
    };
    res.status(400).json(response);
    return;
  }

  next();
}

/**
 * Валидация данных для добавления договоренности
 */
export function validateAddAgreement(req: Request, res: Response, next: NextFunction): void {
  const { title, description, type } = req.body;
  const errors: string[] = [];

  // Проверка title
  if (!title) {
    errors.push('Title is required');
  } else if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
    errors.push('Title must be a non-empty string with maximum 200 characters');
  }

  // Проверка type
  if (!type || !['employee_task', 'manager_task', 'mutual_agreement'].includes(type)) {
    errors.push('Agreement type must be one of: employee_task, manager_task, mutual_agreement');
  }

  // Проверка description (опционально)
  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  if (errors.length > 0) {
    const response: ApiError = {
      error: 'Validation error',
      message: 'Invalid agreement data',
      details: errors.map(error => ({ field: 'general', message: error }))
    };
    res.status(400).json(response);
    return;
  }

  next();
}

/**
 * Валидация данных для обновления договоренности
 */
export function validateUpdateAgreement(req: Request, res: Response, next: NextFunction): void {
  const { agreementId, title, description, type } = req.body;
  const errors: string[] = [];

  // Проверка agreementId
  if (!agreementId) {
    errors.push('Agreement ID is required');
  } else if (typeof agreementId !== 'string' || agreementId.trim().length === 0) {
    errors.push('Agreement ID must be a non-empty string');
  }

  // Проверка title (опционально)
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 200)) {
    errors.push('Title must be a non-empty string with maximum 200 characters');
  }

  // Проверка description (опционально)
  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  // Проверка type (опционально)
  if (type !== undefined && !['employee_task', 'manager_task', 'mutual_agreement'].includes(type)) {
    errors.push('Agreement type must be one of: employee_task, manager_task, mutual_agreement');
  }

  if (errors.length > 0) {
    const response: ApiError = {
      error: 'Validation error',
      message: 'Invalid agreement update data',
      details: errors.map(error => ({ field: 'general', message: error }))
    };
    res.status(400).json(response);
    return;
  }

  next();
}
