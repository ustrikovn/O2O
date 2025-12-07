/**
 * ImmediateAnalyst Agent
 * 
 * Задача: быстрый анализ "здесь и сейчас" — можно ли дать конкретный совет
 * по текущему тексту БЕЗ учёта истории.
 * 
 * Это первый шаг в двухэтапном анализе. Если ImmediateAnalyst находит
 * конкретный совет — используем его. Если нет — переходим к DeepAnalyst.
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
import { ASSISTANT_CONFIG } from '../config.js';
import { 
  getImmediateAnalystSystemPrompt, 
  buildImmediateAnalystUserPrompt 
} from '../prompts/immediate-analyst.prompt.js';
import type { 
  ImmediateAnalystInput, 
  ImmediateAnalystOutput,
  AnalystInsight,
  InsightType,
  RelevanceLevel
} from './types.js';

/** Дефолтный результат при ошибке */
const DEFAULT_OUTPUT: ImmediateAnalystOutput = {
  has_actionable_advice: false,
  reason: 'Ошибка обработки — нужен глубокий анализ',
  situation_summary: 'Не удалось проанализировать',
  needs_deep_analysis: true
};

/**
 * ImmediateAnalyst Agent
 * 
 * Быстро анализирует текущий контекст и определяет,
 * можно ли дать совет "здесь и сейчас".
 */
export class ImmediateAnalystAgent {
  private readonly llm: TextGenerationService;
  
  constructor(llmService?: TextGenerationService) {
    this.llm = llmService || new TextGenerationService();
  }
  
  /**
   * Быстрый анализ текущего контекста
   * 
   * @param input - входные данные (заметки + профиль, БЕЗ истории)
   * @param signal - AbortSignal для отмены запроса
   * @returns результат анализа
   */
  async analyze(
    input: ImmediateAnalystInput, 
    signal?: AbortSignal
  ): Promise<{ output: ImmediateAnalystOutput; durationMs: number }> {
    const startTime = Date.now();
    
    // Проверяем отмену сразу
    if (signal?.aborted) {
      return {
        output: { ...DEFAULT_OUTPUT, reason: 'Запрос отменён' },
        durationMs: Date.now() - startTime
      };
    }
    
    // Быстрая проверка: если заметок нет или они слишком короткие
    if (!input.notes || input.notes.trim().length < 10) {
      return {
        output: {
          has_actionable_advice: false,
          reason: 'Заметки слишком короткие для анализа',
          situation_summary: `Встреча с ${input.employee.name}. Ожидаем заметки.`,
          needs_deep_analysis: false
        },
        durationMs: Date.now() - startTime
      };
    }
    
    try {
      const cfg = getLLMConfig();
      
      const systemPrompt = getImmediateAnalystSystemPrompt();
      const userPrompt = buildImmediateAnalystUserPrompt(input);
      
      const response = await this.llm.generateText({
        system: systemPrompt,
        prompt: userPrompt,
        model: cfg.pipelineModel || 'gpt-4o',
        temperature: 0.3, // Низкая для консистентности
        maxTokens: 500,
        signal,
        timeoutMs: ASSISTANT_CONFIG.timeouts.immediateAnalyst
      });
      
      const durationMs = Date.now() - startTime;
      const output = this.parseResponse(response.text, input.employee.name);
      
      return { output, durationMs };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Если отменено - возвращаем дефолт без лога ошибки
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          output: { ...DEFAULT_OUTPUT, reason: 'Запрос отменён' },
          durationMs
        };
      }
      
      console.error('[ImmediateAnalystAgent] Ошибка:', error);
      
      return {
        output: {
          ...DEFAULT_OUTPUT,
          situation_summary: `Встреча с ${input.employee.name}. Ошибка быстрого анализа.`
        },
        durationMs
      };
    }
  }
  
  /**
   * Парсинг JSON ответа от LLM
   */
  private parseResponse(text: string, employeeName: string): ImmediateAnalystOutput {
    try {
      // Извлекаем JSON из ответа
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[ImmediateAnalystAgent] JSON не найден в ответе');
        return {
          ...DEFAULT_OUTPUT,
          reason: 'JSON не найден в ответе',
          situation_summary: `Встреча с ${employeeName}.`
        };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Формируем результат
      const result: ImmediateAnalystOutput = {
        has_actionable_advice: Boolean(parsed.has_actionable_advice),
        reason: typeof parsed.reason === 'string' ? parsed.reason : 'Без объяснения',
        situation_summary: typeof parsed.situation_summary === 'string' 
          ? parsed.situation_summary.slice(0, 200)
          : `Встреча с ${employeeName}.`,
        needs_deep_analysis: Boolean(parsed.needs_deep_analysis)
      };
      
      // Парсим инсайт если есть
      if (result.has_actionable_advice && parsed.insight) {
        const insight = this.parseInsight(parsed.insight);
        if (insight) {
          result.insight = insight;
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('[ImmediateAnalystAgent] Ошибка парсинга:', error);
      return {
        ...DEFAULT_OUTPUT,
        reason: 'Ошибка парсинга JSON',
        situation_summary: `Встреча с ${employeeName}.`
      };
    }
  }
  
  /**
   * Парсинг и валидация инсайта
   */
  private parseInsight(raw: unknown): AnalystInsight | null {
    if (!raw || typeof raw !== 'object') return null;
    
    const r = raw as Record<string, unknown>;
    
    // Тип инсайта
    const validTypes: InsightType[] = [
      'behavioral_tactic', 'psychological_state', 'hidden_need', 
      'relationship_dynamic', 'risk', 'positive_shift', 'pattern', 
      'opportunity', 'contradiction', 'trend'
    ];
    const type = validTypes.includes(r.type as InsightType) 
      ? (r.type as InsightType) 
      : 'pattern';
    
    // Интерпретация
    const interpretation = typeof r.interpretation === 'string' 
      ? r.interpretation.slice(0, 300) 
      : '';
    
    if (!interpretation) return null;
    
    // Уверенность
    let confidence = typeof r.confidence === 'number' ? r.confidence : 0.5;
    confidence = Math.max(0, Math.min(1, confidence));
    
    // Доказательства
    const evidence: string[] = Array.isArray(r.evidence) 
      ? (r.evidence as unknown[]).filter((e): e is string => typeof e === 'string').slice(0, 3)
      : [];
    
    // Релевантность
    const validRelevance: RelevanceLevel[] = ['high', 'medium', 'low'];
    const relevance = validRelevance.includes(r.relevance as RelevanceLevel) 
      ? (r.relevance as RelevanceLevel) 
      : 'medium';
    
    return { type, interpretation, confidence, evidence, relevance };
  }
}

