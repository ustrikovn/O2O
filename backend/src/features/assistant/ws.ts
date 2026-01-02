import type { Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { AssistantOrchestrator } from './orchestrator.js';
import { onTyping, sessionKey, clearTypingSession } from './typing-detector.js';
import type { ClientEvent, ServerEvent, StatusPayload, PipelineLogPayload } from './types.js';

/** Максимальное время ожидания ответа от pipeline (20 секунд) */
const PIPELINE_TIMEOUT_MS = 20_000;

interface ConnectionState {
  meetingId: string;
  employeeId: string;
  lastNotes?: string;
}

/** Отправка статуса ассистента */
function sendStatus(ws: WebSocket, status: StatusPayload['status']) {
  send(ws, { type: 'status', status });
}

/** 
 * Обёртка для вызова pipeline с timeout
 * Гарантирует что клиент получит ответ даже если LLM зависнет
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
  onTimeout?: () => void
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[WS] Pipeline timeout после ${timeoutMs}ms`);
      onTimeout?.();
      resolve(fallback);
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

export function attachAssistantWsServer(httpServer: HttpServer, path = '/ws/assistant') {
  const wss = new WebSocketServer({ server: httpServer, path });
  const orchestrator = new AssistantOrchestrator();

  wss.on('connection', (ws: WebSocket) => {
    const state: Partial<ConnectionState> = {};

    // Очистка таймера при закрытии соединения
    ws.on('close', () => {
      if (state.meetingId && state.employeeId) {
        const key = sessionKey(state.meetingId, state.employeeId);
        clearTypingSession(key);
        console.log(`[WS] Соединение закрыто, таймер очищен для ${key}`);
      }
    });

    ws.on('message', async (raw: WebSocket.RawData) => {
      try {
        const evt = JSON.parse(String(raw)) as ClientEvent;
        if (evt.type === 'join') {
          state.meetingId = evt.meetingId;
          state.employeeId = evt.employeeId;
          send(ws, { type: 'joined', meetingId: evt.meetingId, employeeId: evt.employeeId });
          
          // Статичное приветствие без LLM
          // (предиктивное саммари будет реализовано отдельно)
          send(ws, {
            type: 'assistant_message',
            text: '👋 Привет! Это твой ассистент. Буду рад помочь тебе сегодня провести эффективную встречу.'
          });
          return;
        }

        if (!state.meetingId || !state.employeeId) {
          send(ws, { type: 'error', message: 'Необходимо отправить событие join сначала' });
          return;
        }

        if (evt.type === 'user_message') {
          // Отправляем статус "thinking"
          sendStatus(ws, 'thinking');
          
          // Callback для отправки логов клиенту
          const onLog = (log: PipelineLogPayload) => send(ws, log);
          
          // Гарантируем отправку idle через finally
          let messages: Awaited<ReturnType<typeof orchestrator.handleUserEvent>> = [];
          try {
            // Используем timeout для защиты от зависания LLM
            messages = await withTimeout(
              orchestrator.handleUserEvent({
                meetingId: state.meetingId!,
                employeeId: state.employeeId!,
                ...(evt.text !== undefined ? { lastUserText: evt.text } : {}),
                ...(state.lastNotes !== undefined ? { lastNotes: state.lastNotes } : {}),
                onLog
              }),
              PIPELINE_TIMEOUT_MS,
              [], // fallback: пустой массив (молчим)
              () => {
                console.warn(`[WS] user_message timeout для ${state.employeeId}`);
                onLog({ type: 'pipeline_log', level: 'error', stage: 'timeout', message: '⏱️ Timeout! Pipeline не успел завершиться' });
              }
            );
          } catch (err) {
            console.error('[WS] Ошибка handleUserEvent:', err);
            onLog({ type: 'pipeline_log', level: 'error', stage: 'error', message: `❌ Ошибка: ${err instanceof Error ? err.message : 'Unknown'}` });
          } finally {
            // ВСЕГДА отправляем статус "idle"
            sendStatus(ws, 'idle');
          }
          
          // Отправляем сообщения если есть
          messages.forEach(m => send(ws, m));
          return;
        }

        if (evt.type === 'notes_update') {
          state.lastNotes = evt.text;
          
          // Callback для отправки логов клиенту
          const onLog = (log: PipelineLogPayload) => send(ws, log);
          
          // Формируем ключ сессии
          const key = sessionKey(state.meetingId!, state.employeeId!);
          
          // Регистрируем событие ввода — запускаем/сбрасываем таймер
          // Callback onPause вызовется когда:
          // 1. Пауза 5 сек обнаружена
          // 2. Проверка контента прошла (удаление или достаточно новых слов)
          onTyping(key, evt.text, async (notes, contentCheck) => {
            // Проверка контента прошла — запускаем анализ
            sendStatus(ws, 'thinking');
            
            try {
              const tips = await withTimeout(
                orchestrator.handleUserEvent({
                  meetingId: state.meetingId!,
                  employeeId: state.employeeId!,
                  lastNotes: notes,
                  onLog
                }),
                PIPELINE_TIMEOUT_MS,
                [], // fallback: пустой массив (молчим)
                () => {
                  console.warn(`[WS] notes_update timeout для ${state.employeeId}`);
                  onLog({ type: 'pipeline_log', level: 'error', stage: 'timeout', message: '⏱️ Timeout! Pipeline не успел завершиться' });
                }
              );
              
              // Отправляем сообщения если есть
              tips.forEach(m => send(ws, m));
            } catch (err) {
              console.error('[WS] Ошибка при анализе заметок:', err);
              onLog({ type: 'pipeline_log', level: 'error', stage: 'error', message: `❌ Ошибка: ${err instanceof Error ? err.message : 'Unknown'}` });
            } finally {
              sendStatus(ws, 'idle');
            }
          }, onLog);
          
          return;
        }

        if (evt.type === 'ping') {
          send(ws, { type: 'pong', ts: evt.ts || Date.now() });
          return;
        }
      } catch (err: any) {
        try { send(ws, { type: 'error', message: err?.message || 'Ошибка обработки события' }); } catch {}
      }
    });
  });

  return wss;
}

function send(ws: WebSocket, payload: ServerEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}


