/**
 * Типы для работы с характеристиками сотрудников
 */

export interface CharacteristicMetadata {
  sources: {
    meetings_count: number;
    surveys_count: number;
    last_meeting_date?: string | undefined;
    last_survey_date?: string | undefined;
  };
  data_richness_score: number; // 0-100
  generation_metadata: {
    model: string;
    tokens_used?: number | undefined;
    generation_time_ms?: number | undefined;
    /** Отпечаток текущего контекста (кол-во и последние даты встреч/опросов, позиция) */
    context_fingerprint?: string | undefined;
  };
}

export interface EmployeeCharacteristic {
  id: string;
  employee_id: string;
  content: string;
  previous_content?: string | null;
  changes_summary?: string | null;
  metadata: CharacteristicMetadata;
  created_at: string;
  updated_at: string;
}

export interface CreateCharacteristicInput {
  employee_id: string;
  content: string;
  changes_summary?: string | undefined;
  metadata: CharacteristicMetadata;
}

export interface UpdateCharacteristicInput {
  content: string;
  changes_summary?: string | undefined;
  metadata: CharacteristicMetadata;
}

export interface DataRichnessLevel {
  level: 'none' | 'minimal' | 'moderate' | 'good' | 'excellent';
  score: number; // 0-100
  description: string;
}

export interface CharacteristicGenerationContext {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    position: string;
    team: string;
  };
  meetings: Array<{
    id: string;
    status: string;
    started_at?: string;
    ended_at?: string;
    content?: {
      notes?: string;
      agreements?: Array<{
        title: string;
        description?: string;
        type: string;
        status?: string;
      }>;
    };
  }>;
  surveys: Array<{
    id: string;
    title: string;
    status: string;
    completed_at?: string | undefined;
    answers?: Array<{
      questionId: string;
      value: any;
    }> | undefined;
    metadata?: {
      disc?: {
        scores?: Record<string, number>;
        profileHint?: string;
        llmDescription?: string;
      };
      bigFive?: {
        averages?: Record<string, number>;
        llmDescription?: string;
      };
    } | undefined;
  }>;
  previous_characteristic?: string | null | undefined;
}

export interface GenerateCharacteristicResult {
  content: string;
  changes_summary?: string | undefined;
  metadata: CharacteristicMetadata;
}

