/**
 * Типы для LLM Pipeline агентов
 * 
 * Pipeline: Analyst → Decision → Composer
 */

// ============================================
// DEBUG ИНФОРМАЦИЯ
// ============================================

/** Debug-информация о вызове агента */
export interface AgentDebugInfo {
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
}

// ============================================
// ОБЩИЕ ТИПЫ
// ============================================

/** Типы вмешательства ассистента */
export type InterventionType =
  | 'proactive_question'  // Предложить вопрос сотруднику
  | 'warning'             // Предупредить о риске
  | 'insight'             // Поделиться наблюдением
  | 'action_card'         // Предложить действие (опрос и т.д.)
  | 'clarification';      // Попросить уточнить

/** Типы инсайтов от Analyst */
export type InsightType =
  | 'behavioral_tactic'    // Тактика взаимодействия (шантаж, манипуляция и т.д.)
  | 'psychological_state'  // Психологическое состояние
  | 'hidden_need'          // Скрытая потребность
  | 'relationship_dynamic' // Динамика отношений
  | 'risk'                 // Риск (выгорание, конфликт)
  | 'positive_shift'       // Позитивное изменение (улучшение, восстановление)
  | 'pattern'              // Повторяющийся паттерн (legacy)
  | 'opportunity'          // Возможность для развития (legacy)
  | 'contradiction'        // Противоречие в словах/поведении (legacy)
  | 'trend';               // Тренд (рост/падение) (legacy)

/** Уровень релевантности */
export type RelevanceLevel = 'high' | 'medium' | 'low';

/** Уровень приоритета */
export type PriorityLevel = 'high' | 'medium' | 'low';

/** Настроение сотрудника */
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'hostile' | 'unknown';

/** Уровень вовлечённости */
export type EngagementLevel = 'high' | 'medium' | 'low' | 'disengaged';

/** Режим взаимодействия сотрудника */
export type InteractionMode = 'constructive' | 'defensive' | 'aggressive' | 'manipulative' | 'withdrawn';

// ============================================
// ANALYST AGENT
// ============================================

/** Договорённость с информацией о давности */
export interface AgreementDetail {
  title: string;
  responsible_type: 'employee_task' | 'manager_task';
  status: string;
  due_date?: string;
  days_ago: number;
  weight: string;
  is_overdue: boolean;
}

/** Входные данные для Analyst */
export interface AnalystInput {
  /** Текущие заметки руководителя */
  notes: string;
  
  /** Информация о сотруднике */
  employee: {
    id: string;
    name: string;
    position?: string;
    team?: string;
  };
  
  /** Характеристика/профиль сотрудника (если есть) */
  characteristic: string | null;
  
  /** История предыдущих встреч */
  previousMeetings: Array<{
    date: string;
    notes?: string;
    satisfaction?: number;
  }>;
  
  /** Количество открытых договорённостей */
  openAgreements: number;
  
  /** Детали открытых договорённостей с весами */
  agreementDetails?: AgreementDetail[];
}

/** Инсайт от Analyst */
export interface AnalystInsight {
  /** Тип инсайта */
  type: InsightType;
  
  /** ИНТЕРПРЕТАЦИЯ поведения (не пересказ!) */
  interpretation: string;
  
  /** Описание инсайта (legacy, для совместимости) */
  description?: string;
  
  /** Уверенность (0.0 - 1.0) */
  confidence: number;
  
  /** Доказательства (цитаты из заметок/истории) */
  evidence: string[];
  
  /** Связь с профилем сотрудника (если есть данные) */
  profile_connection?: string;
  
  /** Релевантность для текущего момента */
  relevance: RelevanceLevel;
}

/** Состояние сотрудника по оценке Analyst */
export interface EmployeeState {
  /** Общее настроение */
  sentiment: SentimentType;
  
  /** Уровень вовлечённости */
  engagement_level: EngagementLevel;
  
  /** Режим взаимодействия */
  interaction_mode?: InteractionMode;
  
  /** Ключевые темы обсуждения */
  key_topics: string[];
}

/** Выходные данные Analyst */
export interface AnalystOutput {
  /** Найденные инсайты */
  insights: AnalystInsight[];
  
  /** Оценка состояния сотрудника */
  employee_state: EmployeeState;
  
  /** Сжатое резюме контекста для Decision */
  context_summary: string;
}

// ============================================
// DECISION AGENT
// ============================================

/** Входные данные для Decision */
export interface DecisionInput {
  /** Результат анализа от Analyst */
  analysis: AnalystOutput;
  
  /** Контекст текущей сессии */
  context: {
    /** Сколько минут идёт встреча */
    meeting_duration_minutes: number;
    
    /** Сколько сообщений отправлено в этой сессии */
    messages_sent_this_session: number;
  };
  
  /** Последние сообщения ассистента (для избежания повторов) */
  recentAssistantMessages: string[];
}

/** Выходные данные Decision */
export interface DecisionOutput {
  /** Главное решение: вмешиваться или молчать */
  should_intervene: boolean;
  
  /** Объяснение решения (для логов) */
  reason: string;
  
  /** Тип вмешательства (если should_intervene = true) */
  intervention_type?: InterventionType;
  
  /** Приоритет (если should_intervene = true) */
  priority?: PriorityLevel;
  
  /** Индекс инсайта из Analyst для использования */
  insight_index?: number;
}

// ============================================
// COMPOSER AGENT
// ============================================

/** Входные данные для Composer */
export interface ComposerInput {
  /** Тип вмешательства от Decision */
  intervention_type: InterventionType;
  
  /** Инсайт от Analyst для формулировки */
  insight: AnalystInsight;
  
  /** Имя сотрудника */
  employee_name: string;
  
  /** Сжатое резюме контекста */
  context_summary: string;
}

/** Формат сообщения */
export type MessageFormat = 'plain' | 'list' | 'question';

/** Сообщение от Composer */
export interface ComposerMessage {
  /** Текст сообщения (≤ 280 символов) */
  text: string;
  
  /** Формат */
  format: MessageFormat;
}

/** Action card от Composer */
export interface ComposerActionCard {
  /** Тип карточки */
  kind: 'start_survey' | 'add_agreement' | 'ask_followup';
  
  /** Заголовок */
  title: string;
  
  /** Подзаголовок */
  subtitle?: string;
  
  /** Call to action */
  cta: {
    label: string;
    action: string;
    params?: Record<string, unknown>;
  };
}

/** Выходные данные Composer */
export interface ComposerOutput {
  /** Текстовое сообщение (опционально) */
  message?: ComposerMessage;
  
  /** Action card (опционально) */
  action_card?: ComposerActionCard;
}

// ============================================
// IMMEDIATE ANALYST AGENT (быстрый анализ "здесь и сейчас")
// ============================================

/** Входные данные для ImmediateAnalyst */
export interface ImmediateAnalystInput {
  /** Текущие заметки руководителя */
  notes: string;
  
  /** Информация о сотруднике */
  employee: {
    id: string;
    name: string;
    position?: string;
    team?: string;
  };
  
  /** Характеристика/профиль сотрудника (если есть) */
  characteristic: string | null;
}

/** Выходные данные ImmediateAnalyst */
export interface ImmediateAnalystOutput {
  /** Есть ли конкретный совет "здесь и сейчас" */
  has_actionable_advice: boolean;
  
  /** Причина решения (для логов) */
  reason: string;
  
  /** Инсайт (если has_actionable_advice = true) */
  insight?: AnalystInsight;
  
  /** Краткое резюме текущей ситуации */
  situation_summary: string;
  
  /** Требуется ли глубокий анализ с историей */
  needs_deep_analysis: boolean;
}

// ============================================
// PROFILE DEVIATION AGENT (обнаружение отклонений)
// ============================================

/** Тип отклонения */
export type DeviationType = 
  | 'profile_mismatch'   // Поведение не соответствует профилю
  | 'history_anomaly'    // Резкое отличие от истории
  | 'both';              // Оба типа

/** Уровень серьёзности отклонения */
export type DeviationSeverity = 'critical' | 'significant' | 'minor';

/** Входные данные для ProfileDeviationAgent */
export interface ProfileDeviationInput {
  /** Текущее описание поведения/состояния сотрудника */
  current_behavior: string;
  
  /** Ключевые темы текущей встречи */
  current_topics: string[];
  
  /** Настроение на текущей встрече */
  current_sentiment: SentimentType;
  
  /** Режим взаимодействия */
  current_interaction_mode?: InteractionMode;
  
  /** Профиль сотрудника */
  profile: string | null;
  
  /** Информация о сотруднике */
  employee: {
    id: string;
    name: string;
    position?: string;
  };
  
  /** История предыдущих встреч (для сравнения) */
  previousMeetings: Array<{
    date: string;
    notes?: string;
    satisfaction?: number;
  }>;
}

/** Выходные данные ProfileDeviationAgent */
export interface ProfileDeviationOutput {
  /** Обнаружено ли отклонение */
  has_deviation: boolean;
  
  /** Тип отклонения (если обнаружено) */
  deviation_type?: DeviationType;
  
  /** Серьёзность отклонения */
  severity?: DeviationSeverity;
  
  /** Описание отклонения для пользователя */
  message?: string;
  
  /** Подробное объяснение (для логов) */
  explanation: string;
  
  /** Рекомендованное действие */
  recommended_action?: string;
}

// ============================================
// STUB для Итерации 1 (без полного Analyst)
// ============================================

/** Минимальный stub для AnalystOutput в Итерации 1 */
export function createStubAnalystOutput(notes: string, employeeName: string): AnalystOutput {
  return {
    insights: notes.trim().length > 0 ? [{
      type: 'pattern',
      interpretation: `Анализ ситуации с ${employeeName}`,
      description: `Заметки о ${employeeName}`,
      confidence: 0.5,
      evidence: [notes.slice(0, 100)],
      relevance: 'medium'
    }] : [],
    employee_state: {
      sentiment: 'unknown',
      engagement_level: 'medium',
      key_topics: []
    },
    context_summary: `Встреча с ${employeeName}. ${notes.slice(0, 150)}`
  };
}


