/**
 * Типы для сущности Employee
 */

import { BaseEntity } from './common.js';

export interface Employee extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  team: string;
  photo_url: string | null;
  is_active: boolean;
}

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  team: string;
  photo?: File | null;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export interface EmployeeResponse extends Omit<Employee, 'photo_url'> {
  photoUrl: string | null;
}

export interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  total_teams: number;
}

export interface TeamInfo {
  team: string;
  employee_count: number;
}
