/**
 * Debug Store для хранения информации о запросах ассистента
 * 
 * Позволяет отлаживать работу LLM pipeline:
 * - Какой контекст был передан
 * - Какие промпты использовались
 * - Какие ответы дали агенты
 */

import { randomUUID } from 'crypto';

/** Информация об одном вызове агента */
export interface AgentCall {
  agent: string;
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
  parsedResponse: unknown;
  durationMs: number;
  timestamp: string;
}

/** Полный debug-лог одного запроса */
export interface DebugLog {
  id: string;
  timestamp: string;
  
  /** Входные данные */
  input: {
    meetingId: string;
    employeeId: string;
    employeeName: string;
    notes: string;
    characteristic?: string;
    previousMeetings?: Array<{ date: string; notes?: string }>;
  };
  
  /** Вызовы агентов */
  agentCalls: AgentCall[];
  
  /** Финальный результат */
  output: {
    decision: 'silence' | 'message' | 'error';
    messages: unknown[];
    reason?: string;
  };
  
  /** Общее время выполнения */
  totalDurationMs: number;
}

/** Хранилище debug-логов (в памяти) */
const debugLogs = new Map<string, DebugLog>();

/** Максимальное количество хранимых логов */
const MAX_LOGS = 200;

/** Порядок добавления (для удаления старых) */
const logOrder: string[] = [];

/**
 * Создать новый debug-лог
 */
export function createDebugLog(input: DebugLog['input']): string {
  const id = randomUUID().slice(0, 8); // Короткий ID для удобства
  
  const log: DebugLog = {
    id,
    timestamp: new Date().toISOString(),
    input,
    agentCalls: [],
    output: {
      decision: 'silence',
      messages: []
    },
    totalDurationMs: 0
  };
  
  // Добавляем в хранилище
  debugLogs.set(id, log);
  logOrder.push(id);
  
  // Удаляем старые если превышен лимит
  while (logOrder.length > MAX_LOGS) {
    const oldId = logOrder.shift();
    if (oldId) debugLogs.delete(oldId);
  }
  
  return id;
}

/**
 * Добавить вызов агента в лог
 */
export function addAgentCall(
  debugId: string,
  call: Omit<AgentCall, 'timestamp'>
): void {
  const log = debugLogs.get(debugId);
  if (!log) return;
  
  log.agentCalls.push({
    ...call,
    timestamp: new Date().toISOString()
  });
}

/**
 * Установить результат
 */
export function setDebugOutput(
  debugId: string,
  output: DebugLog['output'],
  totalDurationMs: number
): void {
  const log = debugLogs.get(debugId);
  if (!log) return;
  
  log.output = output;
  log.totalDurationMs = totalDurationMs;
}

/**
 * Получить debug-лог по ID
 */
export function getDebugLog(id: string): DebugLog | null {
  return debugLogs.get(id) || null;
}

/**
 * Получить список последних логов (краткая информация)
 */
export function getRecentLogs(limit = 20): Array<{
  id: string;
  timestamp: string;
  employeeName: string;
  decision: string;
  totalDurationMs: number;
}> {
  return logOrder
    .slice(-limit)
    .reverse()
    .map(id => {
      const log = debugLogs.get(id);
      if (!log) return null;
      return {
        id: log.id,
        timestamp: log.timestamp,
        employeeName: log.input.employeeName,
        decision: log.output.decision,
        totalDurationMs: log.totalDurationMs
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/**
 * Очистить все логи
 */
export function clearDebugLogs(): void {
  debugLogs.clear();
  logOrder.length = 0;
}


