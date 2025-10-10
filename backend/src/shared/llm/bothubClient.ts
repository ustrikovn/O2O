import { getLLMConfig } from '@/shared/config/llm.js';

export interface HttpRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | undefined;
  body?: unknown;
  signal?: AbortSignal | undefined;
  baseUrlOverride?: string | undefined;
  headers?: Record<string, string> | undefined;
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

  async request<T>({ path, method = 'POST', body, signal, baseUrlOverride, headers }: HttpRequestOptions): Promise<HttpClientResponse<T>> {
    const base = (baseUrlOverride?.replace(/\/$/, '') || this.baseUrl);
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

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
          signal: signal ?? controller.signal
        } as any);

        clearTimeout(timeoutId);

        if (!res.ok) {
          // 429/5xx — разумно ретраить
          if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
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
        lastError = err;
        
        // Логируем детали ошибки
        console.error(`[BothubClient] Attempt ${attempt + 1} failed:`, err);

        // AbortError или сетевые — ретраим до лимита
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
}


