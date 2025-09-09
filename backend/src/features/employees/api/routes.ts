/**
 * Routes для управления сотрудниками
 */

import express, { Request, Response } from 'express';
import { EmployeeEntity, Employee, EmployeeResponse } from '@/entities/employee/index.js';
import { validateEmployee } from '../lib/validation.js';
import { 
  validateUUID, 
  validateQueryParams 
} from '@/shared/api/middleware.js';
import { 
  uploadPhoto, 
  handleUploadError, 
  getFileUrl 
} from '@/shared/api/upload.js';
import { ApiResponse } from '@/shared/types/common.js';

const router = express.Router();

/**
 * Преобразование Employee в EmployeeResponse
 */
function transformEmployeeResponse(employee: Employee): EmployeeResponse {
  return {
    ...employee,
    photoUrl: employee.photo_url ? getFileUrl(employee.photo_url.split('/').pop() || '') : null
  };
}

/**
 * GET /api/employees
 * Получение списка всех сотрудников
 */
router.get('/', validateQueryParams, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, offset, orderBy, orderDirection } = req.query;
    
    const employees = await EmployeeEntity.findAll({
      ...(limit && { limit: Number(limit) }),
      ...(offset && { offset: Number(offset) }),
      ...(orderBy && { orderBy: orderBy as string }),
      ...(orderDirection && { orderDirection: orderDirection as 'ASC' | 'DESC' })
    });
    
    // Добавляем полные URL для фотографий
    const employeesWithPhotos = employees.map(transformEmployeeResponse);
    
    const response: ApiResponse<EmployeeResponse[]> = {
      success: true,
      data: employeesWithPhotos,
      count: employees.length
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения сотрудников:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить список сотрудников'
    });
  }
});

/**
 * GET /api/employees/stats
 * Получение статистики по сотрудникам
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await EmployeeEntity.getStats();
    
    const response: ApiResponse = {
      success: true,
      data: stats
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить статистику'
    });
  }
});

/**
 * GET /api/employees/teams
 * Получение списка команд
 */
router.get('/teams', async (req: Request, res: Response): Promise<void> => {
  try {
    const teams = await EmployeeEntity.getTeams();
    
    const response: ApiResponse = {
      success: true,
      data: teams
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения команд:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить список команд'
    });
  }
});

/**
 * GET /api/employees/:id
 * Получение сотрудника по ID
 */
router.get('/:id', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await EmployeeEntity.findById(req.params.id!);
    
    if (!employee) {
      res.status(404).json({
        error: 'Сотрудник не найден',
        message: 'Сотрудник с указанным ID не существует'
      });
      return;
    }
    
    const response: ApiResponse<EmployeeResponse> = {
      success: true,
      data: transformEmployeeResponse(employee)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения сотрудника:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить данные сотрудника'
    });
  }
});

/**
 * POST /api/employees
 * Создание нового сотрудника
 */
router.post('/', uploadPhoto, handleUploadError, validateEmployee, async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, position, team } = req.body;
    
    // Проверяем, что сотрудник с таким email не существует
    const existingEmployee = await EmployeeEntity.findByEmail(email);
    if (existingEmployee) {
      res.status(409).json({
        error: 'Конфликт данных',
        message: 'Сотрудник с таким email уже существует'
      });
      return;
    }
    
    // Подготавливаем данные для создания
    const employeeData = {
      firstName,
      lastName,
      email,
      position,
      team,
      photoUrl: req.file ? `uploads/photos/${req.file.filename}` : null
    };
    
    // Создаем сотрудника
    const newEmployee = await EmployeeEntity.create(employeeData);
    
    const response: ApiResponse<EmployeeResponse> = {
      success: true,
      message: 'Сотрудник успешно создан',
      data: transformEmployeeResponse(newEmployee)
    };
    
    res.status(201).json(response);
  } catch (error: any) {
    console.error('Ошибка создания сотрудника:', error);
    
    if (error.message.includes('уже существует')) {
      res.status(409).json({
        error: 'Конфликт данных',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось создать сотрудника'
    });
  }
});

/**
 * PUT /api/employees/:id
 * Обновление данных сотрудника
 */
router.put('/:id', validateUUID('id'), uploadPhoto, handleUploadError, validateEmployee, async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, position, team } = req.body;
    const employeeId = req.params.id!;
    
    // Проверяем, что сотрудник существует
    const existingEmployee = await EmployeeEntity.findById(employeeId);
    if (!existingEmployee) {
      res.status(404).json({
        error: 'Сотрудник не найден',
        message: 'Сотрудник с указанным ID не существует'
      });
      return;
    }
    
    // Проверяем email на уникальность (исключая текущего сотрудника)
    if (email !== existingEmployee.email) {
      const employeeWithEmail = await EmployeeEntity.findByEmail(email);
      if (employeeWithEmail && employeeWithEmail.id !== employeeId) {
        res.status(409).json({
          error: 'Конфликт данных',
          message: 'Сотрудник с таким email уже существует'
        });
        return;
      }
    }
    
    // Подготавливаем данные для обновления
    const employeeData = {
      firstName,
      lastName,
      email,
      position,
      team,
      photoUrl: req.file ? `uploads/photos/${req.file.filename}` : existingEmployee.photo_url
    };
    
    // Обновляем сотрудника
    const updatedEmployee = await EmployeeEntity.update(employeeId, employeeData);
    
    if (!updatedEmployee) {
      res.status(404).json({
        error: 'Сотрудник не найден',
        message: 'Сотрудник с указанным ID не существует'
      });
      return;
    }
    
    const response: ApiResponse<EmployeeResponse> = {
      success: true,
      message: 'Данные сотрудника успешно обновлены',
      data: transformEmployeeResponse(updatedEmployee)
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('Ошибка обновления сотрудника:', error);
    
    if (error.message.includes('уже существует')) {
      res.status(409).json({
        error: 'Конфликт данных',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось обновить данные сотрудника'
    });
  }
});

/**
 * DELETE /api/employees/:id
 * Мягкое удаление сотрудника (деактивация)
 */
router.delete('/:id', validateUUID('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedEmployee = await EmployeeEntity.softDelete(req.params.id!);
    
    if (!deletedEmployee) {
      res.status(404).json({
        error: 'Сотрудник не найден',
        message: 'Сотрудник с указанным ID не существует'
      });
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Сотрудник успешно деактивирован',
      data: deletedEmployee
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка удаления сотрудника:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось удалить сотрудника'
    });
  }
});

/**
 * GET /api/employees/team/:team
 * Получение сотрудников по команде
 */
router.get('/team/:team', async (req: Request, res: Response): Promise<void> => {
  try {
    const team = decodeURIComponent(req.params.team!);
    const employees = await EmployeeEntity.findByTeam(team);
    
    // Добавляем полные URL для фотографий
    const employeesWithPhotos = employees.map(transformEmployeeResponse);
    
    const response: ApiResponse<EmployeeResponse[]> = {
      success: true,
      data: employeesWithPhotos,
      count: employees.length
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка получения сотрудников команды:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить сотрудников команды'
    });
  }
});

export default router;
