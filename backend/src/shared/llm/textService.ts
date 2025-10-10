import { getLLMConfig } from '@/shared/config/llm.js';
import { BothubHttpClient } from '@/shared/llm/bothubClient.js';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function?: { name: string; arguments: string };
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<{ type: 'function'; function: { name: string; description?: string; parameters: unknown } }>;
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage & { tool_calls?: ToolCall[] };
  finish_reason: string | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
}

export interface GenerateTextInput {
  system?: string | undefined;
  prompt: string;
  context?: string | undefined;
  model?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  // Перекрытия провайдера (для использования альтернативных путей/базового URL через Bothub)
  baseUrlOverride?: string | undefined;
  pathOverride?: string | undefined; // по умолчанию chatCompletionsPath
  extraBody?: Record<string, unknown> | undefined; // для нестандартных параметров модели
}

export interface GenerateTextResult {
  text: string;
  model: string;
  finishReason?: string | null | undefined;
  raw: ChatCompletionResponse;
}

/**
 * Высокоуровневый сервис для генерации текста через Bothub (OpenAI-совместимый chat completions).
 */
export class TextGenerationService {
  private readonly client: BothubHttpClient;

  constructor(client = new BothubHttpClient()) {
    this.client = client;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const cfg = getLLMConfig();

    const messages: ChatMessage[] = [];
    if (input.system) {
      messages.push({ role: 'system', content: input.system });
    }

    if (input.context) {
      messages.push({ role: 'system', content: `Контекст: ${input.context}` });
    }

    messages.push({ role: 'user', content: input.prompt });

    const requestBody: ChatCompletionRequest = {
      model: input.model || cfg.defaultModel || 'gpt-4o-mini',
      messages,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 512,
      stream: false
    };

    // Подмешиваем extraBody для специальных провайдеров/настроек
    const bodyWithExtras = {
      ...requestBody,
      ...(input.extraBody || {})
    };

    const { data } = await this.client.request<ChatCompletionResponse>({
      path: input.pathOverride || cfg.chatCompletionsPath,
      method: 'POST',
      body: bodyWithExtras,
      baseUrlOverride: input.baseUrlOverride
    });

    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? '';
    return {
      text,
      model: data.model,
      finishReason: choice?.finish_reason ?? null,
      raw: data
    };
  }
}


