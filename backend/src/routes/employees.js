import express from 'express';
import { Employee } from '../models/Employee.js';
import { validateEmployee, validateUUID, validateQueryParams } from '../middleware/validation.js';
import { uploadPhoto, handleUploadError, getFileUrl } from '../middleware/upload.js';

const router = express.Router();

/**
 * GET /api/employees
 * Получение списка всех сотрудников
 */
router.get('/', validateQueryParams, async (req, res) => {
  try {
    const { limit, offset, orderBy, orderDirection } = req.query;
    
    const employees = await Employee.findAll({
      limit,
      offset,
      orderBy,
      orderDirection
    });
    
    // Добавляем полные URL для фотографий
    const employeesWithPhotos = employees.map(employee => ({
      ...employee,
      photoUrl: employee.photo_url ? getFileUrl(employee.photo_url.split('/').pop()) : null
    }));
    
    res.json({
      success: true,
      data: employeesWithPhotos,
      count: employees.length
    });
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
router.get('/stats', async (req, res) => {
  try {
    const stats = await Employee.getStats();
    res.json({
      success: true,
      data: stats
    });
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
router.get('/teams', async (req, res) => {
  try {
    const teams = await Employee.getTeams();
    res.json({
      success: true,
      data: teams
    });
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
router.get('/:id', validateUUID('id'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        error: 'Сотрудник не найден',
        message: 'Сотрудник с указанным ID не существует'
      });
    }
    
    // Добавляем полный URL для фотографии
    if (employee.photo_url) {
      employee.photoUrl = getFileUrl(employee.photo_url.split('/').pop());
    }
    
    res.json({
      success: true,
      data: employee
    });
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
router.post('/', uploadPhoto, handleUploadError, validateEmployee, async (req, res) => {
  try {
    const { firstName, lastName, email, position, team } = req.body;
    
    // Проверяем, что сотрудник с таким email не существует
    const existingEmployee = await Employee.findByEmail(email);
    if (existingEmployee) {
      return res.status(409).json({
        error: 'Конфликт данных',
        message: 'Сотрудник с таким email уже существует'
      });
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
    const newEmployee = await Employee.create(employeeData);
    
    // Добавляем полный URL для фотографии в ответ
    if (newEmployee.photo_url) {
      newEmployee.photoUrl = getFileUrl(newEmployee.photo_url.split('/').pop());
    }
    
    res.status(201).json({
      success: true,
      message: 'Сотрудник успешно создан',
      data: newEmployee
    });
  } catch (error) {
    console.error('Ошибка создания сотрудника:', error);
    
    if (error.message.includes('уже существует')) {
      return res.status(409).json({
        error: 'Конфликт данных',
        message: error.message
      });
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
router.put('/:id', validateUUID('id'), uploadPhoto, handleUploadError, validateEmployee, async (req, res) => {
  try {
    const { firstName, lastName, email, position, team } = req.body;
    const employeeId = req.params.id;
    
    // Проверяем, что сотрудник существует
    const existingEmployee = await Employee.findById(employeeId);
    if (!existingEmployee) {
      return res.status(404).json({
        error: 'Сотрудник не найден',
        message: 'Сотрудник с указанным ID не существует'
      });
    }
    
    // Проверяем email на уникальность (исключая текущего сотрудника)
    if (email !== existingEmployee.email) {
      const employeeWithEmail = await Employee.findByEmail(email);
      if (employeeWithEmail && employeeWithEmail.id !== employeeId) {
        return res.status(409).json({
          error: 'Конфликт данных',
          message: 'Сотрудник с таким email уже существует'
        });
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
    const updatedEmployee = await Employee.update(employeeId, employeeData);
    
    // Добавляем полный URL для фотографии в ответ
    if (updatedEmployee.photo_url) {
      updatedEmployee.photoUrl = getFileUrl(updatedEmployee.photo_url.split('/').pop());
    }
    
    res.json({
      success: true,
      message: 'Данные сотрудника успешно обновлены',
      data: updatedEmployee
    });
  } catch (error) {
    console.error('Ошибка обновления сотрудника:', error);
    
    if (error.message.includes('уже существует')) {
      return res.status(409).json({
        error: 'Конфликт данных',
        message: error.message
      });
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
router.delete('/:id', validateUUID('id'), async (req, res) => {
  try {
    const deletedEmployee = await Employee.softDelete(req.params.id);
    
    if (!deletedEmployee) {
      return res.status(404).json({
        error: 'Сотрудник не найден',
        message: 'Сотрудник с указанным ID не существует'
      });
    }
    
    res.json({
      success: true,
      message: 'Сотрудник успешно деактивирован',
      data: deletedEmployee
    });
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
router.get('/team/:team', async (req, res) => {
  try {
    const team = decodeURIComponent(req.params.team);
    const employees = await Employee.findByTeam(team);
    
    // Добавляем полные URL для фотографий
    const employeesWithPhotos = employees.map(employee => ({
      ...employee,
      photoUrl: employee.photo_url ? getFileUrl(employee.photo_url.split('/').pop()) : null
    }));
    
    res.json({
      success: true,
      data: employeesWithPhotos,
      count: employees.length
    });
  } catch (error) {
    console.error('Ошибка получения сотрудников команды:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить сотрудников команды'
    });
  }
});

export default router;
