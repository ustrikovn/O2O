/**
 * API Routes для отладки ассистента
 * 
 * GET /api/assistant/debug/:id - получить debug-лог по ID
 * GET /api/assistant/debug - список последних логов
 */

import { Router } from 'express';
import { getDebugLog, getRecentLogs } from '../debug-store.js';

const router = Router();

/**
 * Получить debug-лог по ID
 */
router.get('/debug/:id', (req, res) => {
  const { id } = req.params;
  const log = getDebugLog(id);
  
  if (!log) {
    return res.status(404).json({ 
      error: 'Debug log не найден',
      id 
    });
  }
  
  res.json(log);
});

/**
 * Получить список последних логов
 */
router.get('/debug', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const logs = getRecentLogs(limit);
  
  res.json({
    count: logs.length,
    logs
  });
});

/**
 * Красивый HTML-просмотр debug-лога
 */
router.get('/debug/:id/view', (req, res) => {
  const { id } = req.params;
  const log = getDebugLog(id);
  
  if (!log) {
    return res.status(404).send(`
      <html>
        <head><title>Debug Log Not Found</title></head>
        <body style="font-family: system-ui; padding: 40px;">
          <h1>🔍 Debug Log не найден</h1>
          <p>ID: ${id}</p>
          <a href="/api/assistant/debug">← К списку логов</a>
        </body>
      </html>
    `);
  }
  
  // Генерируем HTML для просмотра
  const agentCallsHtml = log.agentCalls.map((call, i) => `
    <div style="margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #333;">
        ${i + 1}. ${call.agent} 
        <span style="color: #666; font-weight: normal;">(${call.durationMs}ms)</span>
      </h3>
      
      <details style="margin: 10px 0;">
        <summary style="cursor: pointer; color: #0066cc;">System Prompt</summary>
        <pre style="background: #fff; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${escapeHtml(call.systemPrompt)}</pre>
      </details>
      
      <details style="margin: 10px 0;">
        <summary style="cursor: pointer; color: #0066cc;">User Prompt</summary>
        <pre style="background: #fff; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${escapeHtml(call.userPrompt)}</pre>
      </details>
      
      <details style="margin: 10px 0;" open>
        <summary style="cursor: pointer; color: #0066cc;">Raw Response</summary>
        <pre style="background: #fff; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${escapeHtml(call.rawResponse)}</pre>
      </details>
      
      <details style="margin: 10px 0;">
        <summary style="cursor: pointer; color: #0066cc;">Parsed Response (JSON)</summary>
        <pre style="background: #fff; padding: 15px; border-radius: 4px; overflow-x: auto;">${escapeHtml(JSON.stringify(call.parsedResponse, null, 2))}</pre>
      </details>
    </div>
  `).join('');
  
  const decisionColor = log.output.decision === 'message' ? '#28a745' : 
                        log.output.decision === 'silence' ? '#6c757d' : '#dc3545';
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Debug: ${id}</title>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: system-ui, -apple-system, sans-serif; 
          max-width: 1200px; 
          margin: 0 auto; 
          padding: 20px;
          background: #fafafa;
        }
        h1 { color: #333; }
        h2 { color: #555; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
        pre { 
          font-size: 13px; 
          line-height: 1.4; 
          white-space: pre-wrap; 
          word-wrap: break-word;
          word-break: break-all;
        }
        .meta { color: #666; margin-bottom: 20px; }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <h1>🔍 Debug Log: ${id}</h1>
      
      <div class="meta">
        <p>
          <strong>Время:</strong> ${new Date(log.timestamp).toLocaleString('ru-RU')} 
          | <strong>Сотрудник:</strong> ${log.input.employeeName}
          | <strong>Общее время:</strong> ${log.totalDurationMs}ms
        </p>
        <p>
          <strong>Результат:</strong> 
          <span class="badge" style="background: ${decisionColor}">
            ${log.output.decision.toUpperCase()}
          </span>
          ${log.output.reason ? `— ${log.output.reason}` : ''}
        </p>
      </div>
      
      <h2>📝 Входные данные</h2>
      <div style="background: #e8f4ff; padding: 20px; border-radius: 8px;">
        <p><strong>Meeting ID:</strong> ${log.input.meetingId}</p>
        <p><strong>Employee ID:</strong> ${log.input.employeeId}</p>
        <p><strong>Заметки:</strong></p>
        <pre style="background: #fff; padding: 15px; border-radius: 4px;">${escapeHtml(log.input.notes || '(пусто)')}</pre>
        ${log.input.characteristic ? `
          <details>
            <summary style="cursor: pointer; color: #0066cc;">Характеристика сотрудника</summary>
            <pre style="background: #fff; padding: 15px; border-radius: 4px;">${escapeHtml(log.input.characteristic)}</pre>
          </details>
        ` : ''}
      </div>
      
      <h2>🤖 Вызовы агентов (${log.agentCalls.length})</h2>
      ${agentCallsHtml || '<p style="color: #666;">Нет вызовов агентов</p>'}
      
      <h2>📤 Результат</h2>
      <div style="background: #e8ffe8; padding: 20px; border-radius: 8px;">
        <pre style="background: #fff; padding: 15px; border-radius: 4px;">${escapeHtml(JSON.stringify(log.output, null, 2))}</pre>
      </div>
      
      <p style="margin-top: 40px;">
        <a href="/api/assistant/debug">← К списку логов</a>
        | <a href="/api/assistant/debug/${id}">JSON</a>
      </p>
    </body>
    </html>
  `);
});

/** Экранирование HTML */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const assistantRoutes = router;

