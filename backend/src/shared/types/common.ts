/**
 * Общие типы для всего приложения
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: ValidationError[];
}

export type UUID = string;

export interface TimestampedEntity {
  created_at: Date;
  updated_at: Date;
}

export interface BaseEntity extends TimestampedEntity {
  id: UUID;
}
