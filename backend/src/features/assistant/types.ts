/**
 * Типы событий WebSocket ассистента
 */

export type WsClientEventType =
  | 'join'
  | 'user_message'
  | 'notes_update'
  | 'ping';

export type WsServerEventType =
  | 'joined'
  | 'assistant_message'
  | 'assistant_message_chunk'  // Стриминг: часть сообщения
  | 'assistant_message_end'    // Стриминг: конец сообщения
  | 'status'                   // Статус ассистента (thinking, composing)
  | 'action_card'
  | 'pipeline_log'             // Логи pipeline для отладки
  | 'error'
  | 'pong';

export interface JoinEvent {
  type: 'join';
  meetingId: string;
  employeeId: string;
}

export interface UserMessageEvent {
  type: 'user_message';
  text: string;
}

export interface NotesUpdateEvent {
  type: 'notes_update';
  text: string;
}

export interface PingEvent {
  type: 'ping';
  ts?: number;
}

export type ClientEvent = JoinEvent | UserMessageEvent | NotesUpdateEvent | PingEvent;

export interface AssistantMessagePayload {
  type: 'assistant_message';
  text: string; // компактный ответ (≤ 420 символов)
}

export type ActionCardType =
  | 'start_survey'
  | 'add_agreement'
  | 'ask_followup'
  | 'clarify_goal';

export interface ActionCardPayload {
  type: 'action_card';
  card: {
    id: string;
    kind: ActionCardType;
    title: string;
    subtitle?: string;
    cta?: { label: string; action: string; params?: Record<string, unknown> };
  };
}

export interface ErrorPayload {
  type: 'error';
  message: string;
}

export interface PongPayload {
  type: 'pong';
  ts?: number;
}

/** Статус ассистента */
export type AssistantStatus = 'thinking' | 'composing' | 'idle';

export interface StatusPayload {
  type: 'status';
  status: AssistantStatus;
}

/** Chunk стриминга */
export interface AssistantMessageChunkPayload {
  type: 'assistant_message_chunk';
  chunk: string;
  messageId: string;
}

/** Конец стриминга */
export interface AssistantMessageEndPayload {
  type: 'assistant_message_end';
  messageId: string;
  fullText: string;
}

/** Лог pipeline для отладки */
export type PipelineLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface PipelineLogPayload {
  type: 'pipeline_log';
  level: PipelineLogLevel;
  stage: string;       // 'analyst' | 'decision' | 'composer' | 'start' | 'end'
  message: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export type ServerEvent =
  | AssistantMessagePayload
  | AssistantMessageChunkPayload
  | AssistantMessageEndPayload
  | StatusPayload
  | ActionCardPayload
  | PipelineLogPayload
  | ErrorPayload
  | PongPayload
  | { type: 'joined'; meetingId: string; employeeId: string };


