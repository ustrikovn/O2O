/**
 * Модель сущности Employee
 */

import { query } from '@/shared/database/connection.js';
import { 
  Employee, 
  CreateEmployeeDto, 
  UpdateEmployeeDto,
  EmployeeStats,
  TeamInfo
} from '@/shared/types/employee.js';
import { PaginationParams } from '@/shared/types/common.js';

export class EmployeeEntity {
  /**
   * Создание нового сотрудника
   */
  static async create(employeeData: {
    firstName: string;
    lastName: string;
    email: string;
    position: string;
    team: string;
    photoUrl?: string | null;
  }): Promise<Employee> {
    const { firstName, lastName, email, position, team, photoUrl } = employeeData;
    
    const sql = `
      INSERT INTO employees (first_name, last_name, email, position, team, photo_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    
    const values = [firstName, lastName, email, position, team, photoUrl || null];
    
    try {
      const result = await query(sql, values);
      return result.rows[0] as Employee;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Сотрудник с таким email уже существует');
      }
      throw error;
    }
  }
  
  /**
   * Получение всех активных сотрудников
   */
  static async findAll(options: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<Employee[]> {
    const { 
      isActive = true, 
      limit, 
      offset, 
      orderBy = 'created_at', 
      orderDirection = 'DESC' 
    } = options;
    
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
    
    const values: any[] = [isActive];
    
    if (limit) {
      sql += ` LIMIT $${values.length + 1}`;
      values.push(limit);
    }
    
    if (offset) {
      sql += ` OFFSET $${values.length + 1}`;
      values.push(offset);
    }
    
    const result = await query(sql, values);
    return result.rows as Employee[];
  }
  
  /**
   * Получение сотрудника по ID
   */
  static async findById(id: string): Promise<Employee | null> {
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
    return (result.rows[0] as Employee) || null;
  }
  
  /**
   * Получение сотрудника по email
   */
  static async findByEmail(email: string): Promise<Employee | null> {
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
    return (result.rows[0] as Employee) || null;
  }
  
  /**
   * Обновление данных сотрудника
   */
  static async update(id: string, employeeData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    position?: string;
    team?: string;
    photoUrl?: string | null;
  }): Promise<Employee | null> {
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
      return (result.rows[0] as Employee) || null;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Сотрудник с таким email уже существует');
      }
      throw error;
    }
  }
  
  /**
   * Мягкое удаление сотрудника (деактивация)
   */
  static async softDelete(id: string): Promise<Pick<Employee, 'id' | 'first_name' | 'last_name' | 'email'> | null> {
    const sql = `
      UPDATE employees 
      SET 
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
      RETURNING id, first_name, last_name, email;
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0] as Pick<Employee, 'id' | 'first_name' | 'last_name' | 'email'> || null;
  }
  
  /**
   * Поиск сотрудников по команде
   */
  static async findByTeam(team: string): Promise<Employee[]> {
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
    return result.rows as Employee[];
  }
  
  /**
   * Получение статистики по сотрудникам
   */
  static async getStats(): Promise<EmployeeStats> {
    const sql = `
      SELECT 
        COUNT(*) as total_employees,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_employees,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_employees,
        COUNT(DISTINCT team) as total_teams
      FROM employees;
    `;
    
    const result = await query(sql);
    return result.rows[0] as EmployeeStats;
  }
  
  /**
   * Получение списка всех команд
   */
  static async getTeams(): Promise<TeamInfo[]> {
    const sql = `
      SELECT DISTINCT team, COUNT(*) as employee_count
      FROM employees 
      WHERE is_active = true
      GROUP BY team
      ORDER BY team;
    `;
    
    const result = await query(sql);
    return result.rows as TeamInfo[];
  }
}
