import type { Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { AssistantOrchestrator } from './orchestrator.js';
import type { ClientEvent, ServerEvent } from './types.js';

interface ConnectionState {
  meetingId: string;
  employeeId: string;
  lastNotes?: string;
}

export function attachAssistantWsServer(httpServer: HttpServer, path = '/ws/assistant') {
  const wss = new WebSocketServer({ server: httpServer, path });
  const orchestrator = new AssistantOrchestrator();

  wss.on('connection', (ws: WebSocket) => {
    const state: Partial<ConnectionState> = {};

    ws.on('message', async (raw: WebSocket.RawData) => {
      try {
        const evt = JSON.parse(String(raw)) as ClientEvent;
        if (evt.type === 'join') {
          state.meetingId = evt.meetingId;
          state.employeeId = evt.employeeId;
          send(ws, { type: 'joined', meetingId: evt.meetingId, employeeId: evt.employeeId });
          // Отправляем стартовую подсказку сразу после подключения
          try {
            const msgs = await orchestrator.handleUserEvent({
              meetingId: state.meetingId,
              employeeId: state.employeeId
            });
            msgs.forEach(m => send(ws, m));
          } catch {}
          return;
        }

        if (!state.meetingId || !state.employeeId) {
          send(ws, { type: 'error', message: 'Необходимо отправить событие join сначала' });
          return;
        }

        if (evt.type === 'user_message') {
          const messages = await orchestrator.handleUserEvent({
            meetingId: state.meetingId!,
            employeeId: state.employeeId!,
            ...(evt.text !== undefined ? { lastUserText: evt.text } : {}),
            ...(state.lastNotes !== undefined ? { lastNotes: state.lastNotes } : {})
          });
          messages.forEach(m => send(ws, m));
          return;
        }

        if (evt.type === 'notes_update') {
          state.lastNotes = evt.text;
          const tips = await orchestrator.handleNotesEvent({
            meetingId: state.meetingId,
            employeeId: state.employeeId,
            notes: evt.text
          });
          tips.forEach(m => send(ws, m));
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


