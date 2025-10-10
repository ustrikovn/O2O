### LLM интеграция через Bothub

Этот модуль предоставляет простой способ вызывать OpenAI-совместимый Chat Completions API через шлюз Bothub.

#### Переменные окружения (backend/.env)

```
BOTHUB_API_KEY=...   # Ключ из Bothub профиля
BOTHUB_BASE_URL=https://bothub.chat/api/v2/openai   # базовый URL шлюза
BOTHUB_CHAT_COMPLETIONS_PATH=/v1/chat/completions   # путь до chat completions
LLM_REQUEST_TIMEOUT_MS=60000
LLM_MAX_RETRIES=2
LLM_DEFAULT_MODEL=gpt-4o-mini
```

#### Быстрый старт (сервер)

```ts
import { TextGenerationService } from '@/shared/llm/textService.js';

const service = new TextGenerationService();
const { text } = await service.generateText({
  system: 'Ты помощник HR для one-to-one встреч',
  context: 'Менеджер: Анна, Сотрудник: Иван',
  prompt: 'Сформируй 5 уточняющих вопросов по задачам на неделю'
});
```

#### Тестовый маршрут

POST `/api/llm/test`

Body:

```
{
  "prompt": "Привет!",
  "context": "", 
  "system": "",
  "model": "gpt-4o-mini"
}
```

Ответ:

```
{
  "success": true,
  "result": { "text": "...", "model": "...", "finishReason": "stop" }
}
```

#### Ссылки

- Bothub Docs: https://bothub.chat/api/documentation/ru

### Выбор моделей и провайдеров

Через Bothub доступны разные провайдеры (совместимый OpenAI маршрут). Можно указать модель per-call, а также переопределить базовый URL/endpoint:

```ts
// Пример: альтернативный провайдер или namespace через Bothub
const { text } = await service.generateText({
  prompt: 'Суммаризируй текст',
  model: 'gpt-4o-mini', // или любая другая модель, доступная через Bothub
  baseUrlOverride: 'https://bothub.chat/api/v2/openai',
  pathOverride: '/v1/chat/completions',
  extraBody: {
    // любые дополнительные параметры для совместимого API (например, logit_bias и т.п.)
  }
});
```


