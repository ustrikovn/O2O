import { getLLMConfig } from '@/shared/config/llm.js';

export interface HttpRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | undefined;
  body?: unknown;
  signal?: AbortSignal | undefined;
  baseUrlOverride?: string | undefined;
  headers?: Record<string, string> | undefined;
  /** Таймаут для конкретного запроса (переопределяет глобальный) */
  timeoutMs?: number | undefined;
}

export interface HttpClientResponse<T> {
  status: number;
  data: T;
}

/**
 * Небольшой HTTP-клиент для Bothub с таймаутом и ретраями.
 * Ожидается OpenAI-совместимый API (chat completions).
 */
export class BothubHttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor() {
    const cfg = getLLMConfig();
    this.baseUrl = cfg.bothubBaseUrl;
    this.apiKey = cfg.bothubApiKey;
    this.timeoutMs = cfg.requestTimeoutMs;
    this.maxRetries = cfg.maxRetries;
  }

  async request<T>({ path, method = 'POST', body, signal, baseUrlOverride, headers, timeoutMs }: HttpRequestOptions): Promise<HttpClientResponse<T>> {
    const base = (baseUrlOverride?.replace(/\/$/, '') || this.baseUrl);
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;

    // Если внешний signal уже отменён - сразу выходим
    if (signal?.aborted) {
      const err = new Error('Request aborted');
      err.name = 'AbortError';
      throw err;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Проверяем отмену перед каждой попыткой
      if (signal?.aborted) {
        const err = new Error('Request aborted');
        err.name = 'AbortError';
        throw err;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

      // Связываем внешний signal с внутренним controller
      const abortHandler = () => controller.abort();
      signal?.addEventListener('abort', abortHandler);

      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${this.apiKey}`,
            ...(headers || {})
          },
          // Строго кодируем JSON и следим за ASCII-заголовками
          body: body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : undefined,
          signal: controller.signal
        } as any);

        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortHandler);

        if (!res.ok) {
          // 429/5xx — разумно ретраить (но не при отмене)
          if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries && !signal?.aborted) {
            await this.sleep(this.backoffMs(attempt));
            continue;
          }
          const text = await res.text().catch(() => '');
          throw new Error(`Bothub HTTP error ${res.status}: ${text}`);
        }

        const data = (await res.json()) as T;
        return { status: res.status, data };
      } catch (err) {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortHandler);
        lastError = err;
        
        // Если отменено внешним signal - не ретраим
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        
        // Логируем детали ошибки
        console.error(`[BothubClient] Attempt ${attempt + 1} failed:`, err);

        // Сетевые ошибки — ретраим до лимита
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unknown Bothub HTTP error');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoffMs(attempt: number): number {
    const base = 300; // 300ms
    const factor = 2 ** attempt;
    const jitter = Math.floor(Math.random() * 100);
    return base * factor + jitter;
  }

  /**
   * Стриминг-запрос к Bothub API (SSE)
   */
  async requestStream({ 
    path, 
    body, 
    onChunk, 
    onDone,
    baseUrlOverride 
  }: {
    path: string;
    body: unknown;
    onChunk: (chunk: string) => void;
    onDone?: (fullText: string) => void;
    baseUrlOverride?: string;
  }): Promise<void> {
    const base = (baseUrlOverride?.replace(/\/$/, '') || this.baseUrl);
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs * 3); // Увеличенный таймаут для стриминга

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream'
        },
        body: Buffer.from(JSON.stringify(body), 'utf8'),
        signal: controller.signal
      } as any);

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Bothub HTTP error ${res.status}: ${text}`);
      }

      if (!res.body) {
        throw new Error('No response body for streaming');
      }

      let fullText = '';
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Парсим SSE формат: data: {...}
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch {
              // Игнорируем невалидный JSON
            }
          }
        }
      }

      onDone?.(fullText);
      
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[BothubClient] Stream error:', err);
      throw err;
    }
  }
}


