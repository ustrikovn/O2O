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
  | 'action_card'
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

export type ServerEvent =
  | AssistantMessagePayload
  | ActionCardPayload
  | ErrorPayload
  | PongPayload
  | { type: 'joined'; meetingId: string; employeeId: string };


