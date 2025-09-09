import { query } from '../database/connection.js';

/**
 * Модель для работы с сотрудниками
 */
export class Employee {
  /**
   * Создание нового сотрудника
   */
  static async create(employeeData) {
    const { firstName, lastName, email, position, team, photoUrl } = employeeData;
    
    const sql = `
      INSERT INTO employees (first_name, last_name, email, position, team, photo_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    
    const values = [firstName, lastName, email, position, team, photoUrl];
    
    try {
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Сотрудник с таким email уже существует');
      }
      throw error;
    }
  }
  
  /**
   * Получение всех активных сотрудников
   */
  static async findAll(options = {}) {
    const { isActive = true, limit, offset, orderBy = 'created_at', orderDirection = 'DESC' } = options;
    
    let sql = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        position,
        team,
        photo_url,
        is_active,
        created_at,
        updated_at
      FROM employees 
      WHERE is_active = $1
      ORDER BY ${orderBy} ${orderDirection}
    `;
    
    const values = [isActive];
    
    if (limit) {
      sql += ` LIMIT $${values.length + 1}`;
      values.push(limit);
    }
    
    if (offset) {
      sql += ` OFFSET $${values.length + 1}`;
      values.push(offset);
    }
    
    const result = await query(sql, values);
    return result.rows;
  }
  
  /**
   * Получение сотрудника по ID
   */
  static async findById(id) {
    const sql = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        position,
        team,
        photo_url,
        is_active,
        created_at,
        updated_at
      FROM employees 
      WHERE id = $1 AND is_active = true;
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }
  
  /**
   * Получение сотрудника по email
   */
  static async findByEmail(email) {
    const sql = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        position,
        team,
        photo_url,
        is_active,
        created_at,
        updated_at
      FROM employees 
      WHERE email = $1 AND is_active = true;
    `;
    
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  }
  
  /**
   * Обновление данных сотрудника
   */
  static async update(id, employeeData) {
    const { firstName, lastName, email, position, team, photoUrl } = employeeData;
    
    const sql = `
      UPDATE employees 
      SET 
        first_name = $2,
        last_name = $3,
        email = $4,
        position = $5,
        team = $6,
        photo_url = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
      RETURNING *;
    `;
    
    const values = [id, firstName, lastName, email, position, team, photoUrl];
    
    try {
      const result = await query(sql, values);
      return result.rows[0] || null;
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Сотрудник с таким email уже существует');
      }
      throw error;
    }
  }
  
  /**
   * Мягкое удаление сотрудника (деактивация)
   */
  static async softDelete(id) {
    const sql = `
      UPDATE employees 
      SET 
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
      RETURNING id, first_name, last_name, email;
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }
  
  /**
   * Поиск сотрудников по команде
   */
  static async findByTeam(team) {
    const sql = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        position,
        team,
        photo_url,
        is_active,
        created_at,
        updated_at
      FROM employees 
      WHERE team = $1 AND is_active = true
      ORDER BY first_name, last_name;
    `;
    
    const result = await query(sql, [team]);
    return result.rows;
  }
  
  /**
   * Получение статистики по сотрудникам
   */
  static async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_employees,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_employees,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_employees,
        COUNT(DISTINCT team) as total_teams
      FROM employees;
    `;
    
    const result = await query(sql);
    return result.rows[0];
  }
  
  /**
   * Получение списка всех команд
   */
  static async getTeams() {
    const sql = `
      SELECT DISTINCT team, COUNT(*) as employee_count
      FROM employees 
      WHERE is_active = true
      GROUP BY team
      ORDER BY team;
    `;
    
    const result = await query(sql);
    return result.rows;
  }
}
