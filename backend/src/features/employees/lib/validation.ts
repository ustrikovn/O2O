/**
 * Валидация данных сотрудников
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@/shared/types/common.js';

/**
 * Middleware для валидации данных сотрудника
 */
export const validateEmployee = (req: Request, res: Response, next: NextFunction): void => {
  const { firstName, lastName, email, position, team } = req.body;
  const errors: ValidationError[] = [];

  // Валидация имени
  if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
    errors.push({
      field: 'firstName',
      message: 'Имя должно содержать минимум 2 символа'
    });
  }

  // Валидация фамилии
  if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 2) {
    errors.push({
      field: 'lastName',
      message: 'Фамилия должна содержать минимум 2 символа'
    });
  }

  // Валидация email
  if (!email || typeof email !== 'string') {
    errors.push({
      field: 'email',
      message: 'Email обязателен для заполнения'
    });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push({
        field: 'email',
        message: 'Некорректный формат email'
      });
    }
  }

  // Валидация должности
  if (!position || typeof position !== 'string' || position.trim().length < 2) {
    errors.push({
      field: 'position',
      message: 'Должность должна содержать минимум 2 символа'
    });
  }

  // Валидация команды
  if (!team || typeof team !== 'string' || team.trim().length < 2) {
    errors.push({
      field: 'team',
      message: 'Команда должна содержать минимум 2 символа'
    });
  }

  // Если есть ошибки валидации
  if (errors.length > 0) {
    res.status(400).json({
      error: 'Ошибки валидации',
      details: errors
    });
    return;
  }

  // Нормализация данных
  req.body.firstName = firstName.trim();
  req.body.lastName = lastName.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.position = position.trim();
  req.body.team = team.trim();

  next();
};
