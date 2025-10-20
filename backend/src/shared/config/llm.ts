/**
 * Конфигурация LLM (Bothub)
 */

export interface LLMConfig {
  bothubApiKey: string;
  bothubBaseUrl: string; // базовый URL (например, Bothub OpenAI-совместимый шлюз)
  chatCompletionsPath: string; // путь до chat completions (по умолчанию: /v1/chat/completions)
  requestTimeoutMs: number;
  maxRetries: number;
  defaultModel?: string | undefined;
  discModel?: string | undefined;
  bigFiveModel?: string | undefined;
}

/**
 * Возвращает конфигурацию LLM из переменных окружения.
 * Не валидирует на этапе импорта — только при вызове функции.
 */
export function getLLMConfig(): LLMConfig {
  const stripInlineComment = (value?: string): string => {
    if (!value) return '';
    const hashIndex = value.indexOf('#');
    const base = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    return base.trim();
  };

  const bothubApiKey = stripInlineComment(process.env.BOTHUB_API_KEY);
  const bothubBaseUrlRaw = stripInlineComment(process.env.BOTHUB_BASE_URL);
  const bothubBaseUrl = bothubBaseUrlRaw ? bothubBaseUrlRaw.replace(/\/$/, '') : '';
  const chatCompletionsPath = stripInlineComment(process.env.BOTHUB_CHAT_COMPLETIONS_PATH) || '/v1/chat/completions';
  const requestTimeoutMs = Number(process.env.LLM_REQUEST_TIMEOUT_MS) || 60000; // 60s
  const maxRetries = Number(process.env.LLM_MAX_RETRIES) || 2;
  const defaultModel = process.env.LLM_DEFAULT_MODEL?.trim();
  const discModel = process.env.LLM_DISC_MODEL?.trim();
  const bigFiveModel = process.env.LLM_BIGFIVE_MODEL?.trim();

  if (!bothubApiKey) {
    throw new Error('BOTHUB_API_KEY не задан. Укажите его в переменных окружения.');
  }

  if (!bothubBaseUrl) {
    throw new Error('BOTHUB_BASE_URL не задан. Укажите базовый URL Bothub шлюза в переменных окружения.');
  }

  // Валидация: ключ должен содержать только ASCII (заголовки HTTP запрещают Unicode)
  if (/[^\x00-\x7F]/.test(bothubApiKey)) {
    throw new Error('BOTHUB_API_KEY содержит не-ASCII символы. Убедитесь, что в строке .env нет комментария после значения.');
  }

  return {
    bothubApiKey,
    bothubBaseUrl,
    chatCompletionsPath,
    requestTimeoutMs,
    maxRetries,
    defaultModel,
    discModel,
    bigFiveModel
  };
}


