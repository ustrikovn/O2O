/**
 * Общие middleware для всего приложения
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@/shared/types/common.js';

/**
 * Класс для API ошибок
 */
export class ApiError extends Error {
  public status: number;
  public details?: any;

  constructor(status: number, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Общий middleware для валидации с помощью Joi
 */
export const validationMiddleware = (
  validationFn: (data: any) => { error?: any; value: any },
  source: 'body' | 'params' | 'query' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    const result = validationFn(data);

    if (result.error) {
      const errorMessage = result.error.details
        ? result.error.details.map((detail: any) => detail.message).join(', ')
        : result.error.message;

      res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        message: errorMessage,
        details: result.error.details || []
      });
      return;
    }

    // Заменяем исходные данные валидированными
    req[source] = result.value;
    next();
  };
};

/**
 * Middleware для валидации UUID
 */
export const validateUUID = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const uuid = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuid || !uuidRegex.test(uuid)) {
      res.status(400).json({
        error: 'Некорректный идентификатор',
        message: `Параметр ${paramName} должен быть валидным UUID`
      });
      return;
    }
    
    next();
  };
};

/**
 * Middleware для валидации параметров запроса
 */
export const validateQueryParams = (req: Request, res: Response, next: NextFunction): void => {
  const { limit, offset, orderBy, orderDirection } = req.query;
  
  // Валидация limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        error: 'Некорректный параметр limit',
        message: 'limit должен быть числом от 1 до 100'
      });
      return;
    }
    req.query.limit = limitNum.toString();
  }
  
  // Валидация offset
  if (offset !== undefined) {
    const offsetNum = parseInt(offset as string);
    if (isNaN(offsetNum) || offsetNum < 0) {
      res.status(400).json({
        error: 'Некорректный параметр offset',
        message: 'offset должен быть числом больше или равным 0'
      });
      return;
    }
    req.query.offset = offsetNum.toString();
  }
  
  // Валидация orderBy
  if (orderBy !== undefined) {
    const allowedFields = ['first_name', 'last_name', 'email', 'position', 'team', 'created_at', 'updated_at'];
    if (!allowedFields.includes(orderBy as string)) {
      res.status(400).json({
        error: 'Некорректный параметр orderBy',
        message: `orderBy должен быть одним из: ${allowedFields.join(', ')}`
      });
      return;
    }
  }
  
  // Валидация orderDirection
  if (orderDirection !== undefined) {
    const allowedDirections = ['ASC', 'DESC', 'asc', 'desc'];
    if (!allowedDirections.includes(orderDirection as string)) {
      res.status(400).json({
        error: 'Некорректный параметр orderDirection',
        message: 'orderDirection должен быть ASC или DESC'
      });
      return;
    }
    req.query.orderDirection = (orderDirection as string).toUpperCase();
  }
  
  next();
};

/**
 * Общий обработчик ошибок валидации
 */
export const handleValidationError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: 'Ошибка валидации',
      message: error.message,
      details: error.details || []
    });
    return;
  }
  
  next(error);
};
