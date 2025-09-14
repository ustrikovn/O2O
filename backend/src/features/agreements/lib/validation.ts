import { Request, Response, NextFunction } from 'express';
import { AgreementStatus, ResponsibleType } from '../../../entities/agreement/model/agreement.js';

const VALID_RESPONSIBLE_TYPES: ResponsibleType[] = ['employee_task', 'manager_task'];
const VALID_STATUSES: AgreementStatus[] = ['pending', 'marked_for_completion', 'completed'];

/**
 * Валидация создания договоренности
 */
export function validateCreateAgreement(req: Request, res: Response, next: NextFunction): void {
  const { meeting_id, employee_id, title, description, responsible_type, due_date } = req.body;
  
  // Проверка обязательных полей
  if (!meeting_id || typeof meeting_id !== 'string') {
    res.status(400).json({
      error: 'Неверные данные',
      message: 'Поле meeting_id обязательно и должно быть строкой'
    });
    return;
  }
  
  if (!employee_id || typeof employee_id !== 'string') {
    res.status(400).json({
      error: 'Неверные данные',
      message: 'Поле employee_id обязательно и должно быть строкой'
    });
    return;
  }
  
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({
      error: 'Неверные данные',
      message: 'Поле title обязательно и не может быть пустым'
    });
    return;
  }
  
  if (title.trim().length > 500) {
    res.status(400).json({
      error: 'Неверные данные',
      message: 'Заголовок договоренности не может быть длиннее 500 символов'
    });
    return;
  }
  
  if (!responsible_type || !VALID_RESPONSIBLE_TYPES.includes(responsible_type)) {
    res.status(400).json({
      error: 'Неверные данные',
      message: `Поле responsible_type должно быть одним из: ${VALID_RESPONSIBLE_TYPES.join(', ')}`
    });
    return;
  }
  
  // Проверка опциональных полей
  if (description && (typeof description !== 'string' || description.length > 2000)) {
    res.status(400).json({
      error: 'Неверные данные',
      message: 'Описание должно быть строкой не длиннее 2000 символов'
    });
    return;
  }
  
  if (due_date && (typeof due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due_date))) {
    res.status(400).json({
      error: 'Неверные данные',
      message: 'Дата выполнения должна быть в формате YYYY-MM-DD'
    });
    return;
  }
  
  // Валидация даты
  if (due_date) {
    const date = new Date(due_date);
    if (isNaN(date.getTime())) {
      res.status(400).json({
        error: 'Неверные данные',
        message: 'Некорректная дата выполнения'
      });
      return;
    }
  }
  
  next();
}

/**
 * Валидация обновления статуса договоренности
 */
export function validateUpdateAgreementStatus(req: Request, res: Response, next: NextFunction): void {
  const { status } = req.body;
  
  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      error: 'Неверные данные',
      message: `Статус должен быть одним из: ${VALID_STATUSES.join(', ')}`
    });
    return;
  }
  
  next();
}
