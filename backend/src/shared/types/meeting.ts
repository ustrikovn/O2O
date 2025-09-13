/**
 * Типы для полностью JSON системы встреч
 */

import { BaseEntity, UUID } from './common.js';

// Перечисления
export type MeetingStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type AgreementType = 'employee_task' | 'manager_task' | 'mutual_agreement';

// Структура договоренности в JSON
export interface Agreement {
  id: string;
  title: string;
  description?: string | undefined;
  type: AgreementType;
  created_at: string; // ISO string
}

// Структура контента встречи в JSON
export interface MeetingContent {
  notes?: string | undefined; // Заметки встречи
  agreements?: Agreement[] | undefined; // Массив договоренностей
}

// Основная сущность встречи
export interface Meeting extends BaseEntity {
  employee_id: UUID;
  status: MeetingStatus;
  started_at: Date | null;
  ended_at: Date | null;
  content: MeetingContent; // Весь контент в JSON
}

// DTO для создания и обновления встреч
export interface CreateMeetingDto {
  employeeId: UUID;
}

export interface StartMeetingDto {
  startedAt?: Date | undefined; // Если не передано, используется текущее время
}

export interface EndMeetingDto {
  endedAt?: Date | undefined; // Если не передано, используется текущее время
  notes?: string; // Заметки встречи
}

export interface UpdateMeetingNotesDto {
  notes: string;
}

export interface AddAgreementDto {
  title: string;
  description?: string;
  type: AgreementType;
}

export interface UpdateAgreementDto {
  agreementId: string;
  title?: string;
  description?: string;
  type?: AgreementType;
}

// Типы для ответов API
export interface MeetingResponse extends Omit<Meeting, 'employee_id'> {
  employeeId: UUID;
  employee?: {
    id: UUID;
    firstName: string;
    lastName: string;
    email: string;
    photoUrl: string | null;
  };
  agreementsCount?: number;
}

// Типы для статистики
export interface MeetingStats {
  totalMeetings: number;
  activeMeetings: number;
  completedMeetings: number;
  scheduledMeetings: number;
  averageMeetingDuration: number | null; // в минутах
}

export interface EmployeeMeetingStats {
  employeeId: UUID;
  totalMeetings: number;
  completedMeetings: number;
  lastMeetingDate: Date | null;
  totalAgreements: number;
}

// Типы для фильтрации
export interface MeetingFilterParams {
  employeeId?: UUID;
  status?: MeetingStatus;
  dateFrom?: Date;
  dateTo?: Date;
  hasNotes?: boolean;
  hasAgreements?: boolean;
}
