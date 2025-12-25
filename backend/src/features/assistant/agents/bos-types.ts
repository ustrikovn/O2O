/**
 * Типы для BOS (Behavioral Observation Scale) агента
 * 
 * BOS — методика структурированного наблюдения поведения сотрудников
 * на one-to-one встречах.
 */

/**
 * 12 ключевых поведений BOS
 */
export type BOSBehaviorKey = 
  | 'problem_articulation'       // Выражение проблем
  | 'interest_articulation'      // Выражение интересов
  | 'proactive_communication'    // Инициативная коммуникация
  | 'collaborative_behavior'     // Сотрудничество
  | 'feedback_receptivity'       // Восприимчивость к обратной связи
  | 'task_ownership'             // Ответственность за задачи
  | 'goal_alignment'             // Согласованность целей
  | 'learning_agility'           // Готовность к обучению
  | 'decision_quality'           // Качество решений
  | 'emotional_intelligence'     // Эмоциональный интеллект
  | 'commitment_to_agreements'   // Соблюдение договорённостей
  | 'strategic_thinking';        // Стратегическое мышление

/**
 * Массив всех ключей BOS поведений (для валидации)
 */
export const BOS_BEHAVIOR_KEYS: BOSBehaviorKey[] = [
  'problem_articulation',
  'interest_articulation',
  'proactive_communication',
  'collaborative_behavior',
  'feedback_receptivity',
  'task_ownership',
  'goal_alignment',
  'learning_agility',
  'decision_quality',
  'emotional_intelligence',
  'commitment_to_agreements',
  'strategic_thinking'
];

/**
 * Названия поведений на русском
 */
export const BOS_BEHAVIOR_NAMES: Record<BOSBehaviorKey, string> = {
  problem_articulation: 'Выражение проблем',
  interest_articulation: 'Выражение интересов',
  proactive_communication: 'Инициативная коммуникация',
  collaborative_behavior: 'Сотрудничество',
  feedback_receptivity: 'Восприимчивость к обратной связи',
  task_ownership: 'Ответственность за задачи',
  goal_alignment: 'Согласованность целей',
  learning_agility: 'Готовность к обучению',
  decision_quality: 'Качество решений',
  emotional_intelligence: 'Эмоциональный интеллект',
  commitment_to_agreements: 'Соблюдение договорённостей',
  strategic_thinking: 'Стратегическое мышление'
};

/**
 * Оценка одного поведения
 */
export interface BOSScore {
  /** Оценка 1-5 или null если поведение не наблюдалось */
  score: number | null;
  /** Цитата или факт из заметок как доказательство оценки */
  evidence: string | null;
}

/**
 * Полный набор BOS оценок
 */
export type BOSScores = Record<BOSBehaviorKey, BOSScore>;

/**
 * Статус обработки BOS наблюдения
 */
export type BOSObservationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Договорённость для анализа
 */
export interface BOSAgreementInput {
  title: string;
  description?: string;
  type: 'employee_task' | 'manager_task';
}

/**
 * Входные данные для BOS анализа
 */
export interface BOSAnalysisInput {
  /** ID встречи */
  meetingId: string;
  /** ID сотрудника */
  employeeId: string;
  /** Имя сотрудника (для контекста в промпте) */
  employeeName: string;
  /** Заметки руководителя с встречи */
  notes: string;
  /** Договорённости, созданные на этой встрече */
  agreements: BOSAgreementInput[];
}

/**
 * Результат BOS анализа от LLM
 */
export interface BOSAnalysisOutput {
  /** Оценки по 12 поведениям */
  scores: BOSScores;
}

/**
 * Метаданные генерации BOS
 */
export interface BOSMetadata {
  /** Модель LLM */
  model: string;
  /** Количество использованных токенов */
  tokens_used?: number;
  /** Время генерации в мс */
  generation_time_ms: number;
  /** Информация о входных данных */
  input_data: {
    notes_length: number;
    agreements_count: number;
  };
}

/**
 * Полная запись BOS наблюдения из БД
 */
export interface BOSObservation {
  id: string;
  meeting_id: string;
  employee_id: string;
  status: BOSObservationStatus;
  error_message: string | null;
  scores: BOSScores;
  metadata: BOSMetadata;
  created_at: Date;
  completed_at: Date | null;
}

/**
 * Данные для создания BOS наблюдения
 */
export interface CreateBOSObservationInput {
  meeting_id: string;
  employee_id: string;
}

/**
 * Данные для обновления BOS наблюдения
 */
export interface UpdateBOSObservationInput {
  status?: BOSObservationStatus;
  error_message?: string | null;
  scores?: BOSScores;
  metadata?: BOSMetadata;
  completed_at?: Date;
}
