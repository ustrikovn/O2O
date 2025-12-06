/**
 * Decision Agent
 * 
 * Задача: решить, нужно ли ассистенту вмешиваться или лучше промолчать.
 * Использует Claude 4 для принятия решения.
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
import { getDecisionSystemPrompt, buildDecisionUserPrompt } from '../prompts/decision.prompt.js';
import type { DecisionInput, DecisionOutput, InterventionType, PriorityLevel } from './types.js';

/** Дефолтный результат при ошибке парсинга */
const DEFAULT_SILENCE: DecisionOutput = {
  should_intervene: false,
  reason: 'Ошибка обработки — безопасно молчим'
};

/**
 * Класс Decision Agent
 * 
 * Принимает результат анализа и решает: говорить или молчать.
 */
export class DecisionAgent {
  private readonly llm: TextGenerationService;
  
  constructor(llmService?: TextGenerationService) {
    this.llm = llmService || new TextGenerationService();
  }
  
  /**
   * Принять решение: вмешиваться или молчать
   * 
   * @param input - входные данные с анализом и контекстом
   * @param signal - AbortSignal для отмены запроса
   * @returns решение с обоснованием
   */
  async decide(input: DecisionInput, signal?: AbortSignal): Promise<{ output: DecisionOutput; durationMs: number }> {
    const startTime = Date.now();
    
    // Проверяем отмену сразу
    if (signal?.aborted) {
      return {
        output: { ...DEFAULT_SILENCE, reason: 'Запрос отменён' },
        durationMs: Date.now() - startTime
      };
    }
    
    try {
      const cfg = getLLMConfig();
      
      const systemPrompt = getDecisionSystemPrompt();
      const userPrompt = buildDecisionUserPrompt(input);
      
      const response = await this.llm.generateText({
        system: systemPrompt,
        prompt: userPrompt,
        model: cfg.pipelineModel || 'gpt-4o',
        temperature: 0.2, // Низкая температура для консистентности
        maxTokens: 200,   // Короткий ответ — только JSON
        signal,
        timeoutMs: 5000   // Жёсткий таймаут 5 секунд на Decision
      });
      
      const durationMs = Date.now() - startTime;
      const output = this.parseResponse(response.text);
      
      return { output, durationMs };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Если отменено - возвращаем молчание без лога ошибки
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          output: { ...DEFAULT_SILENCE, reason: 'Запрос отменён' },
          durationMs
        };
      }
      
      console.error('[DecisionAgent] Ошибка:', error);
      
      return {
        output: {
          ...DEFAULT_SILENCE,
          reason: `Ошибка LLM: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        durationMs
      };
    }
  }
  
  /**
   * Парсинг JSON ответа от LLM
   */
  private parseResponse(text: string): DecisionOutput {
    try {
      // Пытаемся найти JSON в ответе
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[DecisionAgent] JSON не найден в ответе:', text.slice(0, 200));
        return { ...DEFAULT_SILENCE, reason: 'JSON не найден в ответе LLM' };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Валидация обязательных полей
      if (typeof parsed.should_intervene !== 'boolean') {
        console.warn('[DecisionAgent] Некорректный should_intervene:', parsed);
        return { ...DEFAULT_SILENCE, reason: 'Некорректный формат ответа' };
      }
      
      const result: DecisionOutput = {
        should_intervene: parsed.should_intervene,
        reason: typeof parsed.reason === 'string' ? parsed.reason : 'Без объяснения'
      };
      
      // Дополнительные поля только если should_intervene = true
      if (result.should_intervene) {
        if (this.isValidInterventionType(parsed.intervention_type)) {
          result.intervention_type = parsed.intervention_type;
        }
        
        if (this.isValidPriority(parsed.priority)) {
          result.priority = parsed.priority;
        } else {
          result.priority = 'medium'; // Дефолт
        }
        
        if (typeof parsed.insight_index === 'number' && parsed.insight_index >= 0) {
          result.insight_index = parsed.insight_index;
        } else {
          result.insight_index = 0; // Дефолт — первый инсайт
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('[DecisionAgent] Ошибка парсинга JSON:', error);
      console.error('[DecisionAgent] Текст ответа:', text.slice(0, 500));
      return { ...DEFAULT_SILENCE, reason: 'Ошибка парсинга JSON' };
    }
  }
  
  /**
   * Валидация типа вмешательства
   */
  private isValidInterventionType(value: unknown): value is InterventionType {
    const validTypes: InterventionType[] = [
      'proactive_question',
      'warning',
      'insight',
      'action_card',
      'clarification'
    ];
    return typeof value === 'string' && validTypes.includes(value as InterventionType);
  }
  
  /**
   * Валидация приоритета
   */
  private isValidPriority(value: unknown): value is PriorityLevel {
    return value === 'high' || value === 'medium' || value === 'low';
  }
}

