/**
 * Composer Agent
 * 
 * Задача: генерация финального сообщения на основе решения Decision.
 * Использует специализированные промпты для разных типов вмешательств.
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
import { getComposerSystemPrompt, buildComposerUserPrompt } from '../prompts/composer.prompt.js';
import type { 
  ComposerInput, 
  ComposerOutput, 
  ComposerMessage,
  ComposerActionCard,
  MessageFormat 
} from './types.js';

/** Дефолтный результат при ошибке */
const DEFAULT_OUTPUT: ComposerOutput = {
  message: {
    text: '💡 Продолжайте диалог, я слежу за контекстом.',
    format: 'plain'
  }
};

/**
 * Класс Composer Agent
 * 
 * Генерирует финальные сообщения для пользователя.
 */
export class ComposerAgent {
  private readonly llm: TextGenerationService;
  
  constructor(llmService?: TextGenerationService) {
    this.llm = llmService || new TextGenerationService();
  }
  
  /**
   * Сгенерировать сообщение
   * 
   * @param input - входные данные с типом вмешательства и инсайтом
   * @param signal - AbortSignal для отмены запроса
   * @returns сообщение или action_card
   */
  async compose(input: ComposerInput, signal?: AbortSignal): Promise<{ output: ComposerOutput; durationMs: number }> {
    const startTime = Date.now();
    
    // Проверяем отмену сразу
    if (signal?.aborted) {
      return { output: DEFAULT_OUTPUT, durationMs: Date.now() - startTime };
    }
    
    try {
      const cfg = getLLMConfig();
      
      const systemPrompt = getComposerSystemPrompt(input.intervention_type);
      const userPrompt = buildComposerUserPrompt(input);
      
      const response = await this.llm.generateText({
        system: systemPrompt,
        prompt: userPrompt,
        model: cfg.pipelineModel || 'claude-sonnet-4-20250514',
        temperature: 0.6, // Чуть выше для креативности
        maxTokens: 800,   // Увеличено для полных ответов
        signal,
        timeoutMs: 8000   // Увеличен таймаут
      });
      
      const durationMs = Date.now() - startTime;
      const output = this.parseResponse(response.text, input.intervention_type);
      
      return { output, durationMs };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Если отменено - возвращаем дефолт без лога ошибки
      if (error instanceof Error && error.name === 'AbortError') {
        return { output: DEFAULT_OUTPUT, durationMs };
      }
      
      console.error('[ComposerAgent] Ошибка:', error);
      
      return { output: DEFAULT_OUTPUT, durationMs };
    }
  }
  
  /**
   * Парсинг ответа от LLM
   */
  private parseResponse(text: string, interventionType: string): ComposerOutput {
    const trimmedText = text.trim();
    
    // Если тип action_card — пытаемся распарсить JSON
    if (interventionType === 'action_card') {
      const actionCard = this.parseActionCard(trimmedText);
      if (actionCard) {
        return { action_card: actionCard };
      }
      // Fallback — вернуть как обычное сообщение
    }
    
    // Определяем формат сообщения
    let format: MessageFormat = 'plain';
    if (interventionType === 'proactive_question' || trimmedText.endsWith('?')) {
      format = 'question';
    }
    
    // НЕ обрезаем текст — показываем полный ответ
    return {
      message: {
        text: trimmedText,
        format
      }
    };
  }
  
  /**
   * Парсинг action_card из JSON
   */
  private parseActionCard(text: string): ComposerActionCard | null {
    try {
      // Ищем JSON в тексте
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Валидация обязательных полей
      if (!parsed.kind || !parsed.title) return null;
      
      // Валидация kind
      const validKinds = ['start_survey', 'add_agreement', 'ask_followup'];
      if (!validKinds.includes(parsed.kind)) return null;
      
      const result: ComposerActionCard = {
        kind: parsed.kind,
        title: String(parsed.title).slice(0, 100)
      };
      
      if (parsed.subtitle) {
        result.subtitle = String(parsed.subtitle).slice(0, 150);
      }
      
      if (parsed.cta && typeof parsed.cta === 'object') {
        result.cta = {
          label: String(parsed.cta.label || 'Действие').slice(0, 50),
          action: String(parsed.cta.action || 'doAction'),
          params: parsed.cta.params || {}
        };
      } else {
        // Дефолтный CTA
        result.cta = {
          label: 'Выполнить',
          action: parsed.kind
        };
      }
      
      return result;
      
    } catch (error) {
      console.warn('[ComposerAgent] Не удалось распарсить action_card:', error);
      return null;
    }
  }
}



