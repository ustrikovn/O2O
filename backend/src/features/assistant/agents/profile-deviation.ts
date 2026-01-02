/**
 * ProfileDeviationAgent
 * 
 * Задача: обнаружение существенных отклонений поведения сотрудника
 * от его профиля и/или от истории предыдущих встреч.
 * 
 * Работает ПОСЛЕ основного анализа (Analyst) и генерирует
 * отдельную карточку/сообщение при обнаружении отклонения.
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
import { ASSISTANT_CONFIG } from '../config.js';
import { 
  getProfileDeviationSystemPrompt, 
  buildProfileDeviationUserPrompt 
} from '../prompts/profile-deviation.prompt.js';
import type { 
  ProfileDeviationInput, 
  ProfileDeviationOutput,
  DeviationType,
  DeviationSeverity
} from './types.js';

/** Дефолтный результат — нет отклонения */
const DEFAULT_OUTPUT: ProfileDeviationOutput = {
  has_deviation: false,
  explanation: 'Нет данных для анализа отклонений'
};

/**
 * ProfileDeviationAgent
 * 
 * Анализирует поведение сотрудника и ищет отклонения от профиля/истории.
 */
export class ProfileDeviationAgent {
  private readonly llm: TextGenerationService;
  
  constructor(llmService?: TextGenerationService) {
    this.llm = llmService || new TextGenerationService();
  }
  
  /**
   * Проверить наличие отклонений
   * 
   * @param input - входные данные с текущим поведением, профилем и историей
   * @param signal - AbortSignal для отмены запроса
   * @returns результат проверки на отклонения
   */
  async analyze(
    input: ProfileDeviationInput, 
    signal?: AbortSignal
  ): Promise<{ output: ProfileDeviationOutput; durationMs: number }> {
    const startTime = Date.now();
    
    // Проверяем отмену сразу
    if (signal?.aborted) {
      return {
        output: { ...DEFAULT_OUTPUT, explanation: 'Запрос отменён' },
        durationMs: Date.now() - startTime
      };
    }
    
    // Быстрая проверка: если нет ни профиля, ни истории — не с чем сравнивать
    if (!input.profile && input.previousMeetings.length === 0) {
      return {
        output: {
          has_deviation: false,
          explanation: 'Нет профиля и истории для сравнения'
        },
        durationMs: Date.now() - startTime
      };
    }
    
    // Если текущее поведение не описано
    if (!input.current_behavior || input.current_behavior.trim().length < 10) {
      return {
        output: {
          has_deviation: false,
          explanation: 'Недостаточно данных о текущем поведении'
        },
        durationMs: Date.now() - startTime
      };
    }
    
    try {
      const cfg = getLLMConfig();
      
      const systemPrompt = getProfileDeviationSystemPrompt();
      const userPrompt = buildProfileDeviationUserPrompt(input);
      
      const response = await this.llm.generateText({
        system: systemPrompt,
        prompt: userPrompt,
        model: cfg.pipelineModel || 'gpt-4o',
        temperature: 0.2, // Низкая для консистентности
        maxTokens: 400,
        signal,
        timeoutMs: ASSISTANT_CONFIG.timeouts.profileDeviation
      });
      
      const durationMs = Date.now() - startTime;
      const output = this.parseResponse(response.text);
      
      return { output, durationMs };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Если отменено - возвращаем дефолт без лога ошибки
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          output: { ...DEFAULT_OUTPUT, explanation: 'Запрос отменён' },
          durationMs
        };
      }
      
      console.error('[ProfileDeviationAgent] Ошибка:', error);
      
      return {
        output: {
          has_deviation: false,
          explanation: `Ошибка анализа: ${error instanceof Error ? error.message : 'Unknown'}`
        },
        durationMs
      };
    }
  }
  
  /**
   * Парсинг JSON ответа от LLM
   */
  private parseResponse(text: string): ProfileDeviationOutput {
    try {
      // Извлекаем JSON из ответа
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[ProfileDeviationAgent] JSON не найден в ответе');
        return {
          has_deviation: false,
          explanation: 'JSON не найден в ответе LLM'
        };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Базовый результат
      const result: ProfileDeviationOutput = {
        has_deviation: Boolean(parsed.has_deviation),
        explanation: typeof parsed.explanation === 'string' 
          ? parsed.explanation 
          : 'Без объяснения'
      };
      
      // Дополнительные поля только если есть отклонение
      if (result.has_deviation) {
        // Тип отклонения
        if (this.isValidDeviationType(parsed.deviation_type)) {
          result.deviation_type = parsed.deviation_type;
        } else {
          result.deviation_type = 'history_anomaly'; // дефолт
        }
        
        // Серьёзность
        if (this.isValidSeverity(parsed.severity)) {
          result.severity = parsed.severity;
        } else {
          result.severity = 'significant'; // дефолт
        }
        
        // Сообщение для пользователя
        if (typeof parsed.message === 'string') {
          result.message = parsed.message.slice(0, 200);
        }
        
        // Рекомендованное действие
        if (typeof parsed.recommended_action === 'string') {
          result.recommended_action = parsed.recommended_action.slice(0, 200);
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('[ProfileDeviationAgent] Ошибка парсинга:', error);
      return {
        has_deviation: false,
        explanation: 'Ошибка парсинга JSON'
      };
    }
  }
  
  /**
   * Валидация типа отклонения
   */
  private isValidDeviationType(value: unknown): value is DeviationType {
    return value === 'profile_mismatch' || value === 'history_anomaly' || value === 'both';
  }
  
  /**
   * Валидация серьёзности
   */
  private isValidSeverity(value: unknown): value is DeviationSeverity {
    return value === 'critical' || value === 'significant' || value === 'minor';
  }
}



