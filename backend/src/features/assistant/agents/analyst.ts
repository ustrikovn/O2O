/**
 * Analyst Agent
 * 
 * Задача: глубокий анализ контекста встречи, поиск инсайтов.
 * Использует Claude 4 для анализа.
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
import { getAnalystSystemPrompt, buildAnalystUserPrompt } from '../prompts/analyst.prompt.js';
import type { 
  AnalystInput, 
  AnalystOutput, 
  AnalystInsight, 
  EmployeeState,
  InsightType,
  RelevanceLevel,
  SentimentType,
  EngagementLevel,
  InteractionMode
} from './types.js';

/** Дефолтный результат при ошибке */
const DEFAULT_OUTPUT: AnalystOutput = {
  insights: [],
  employee_state: {
    sentiment: 'unknown',
    engagement_level: 'medium',
    key_topics: []
  },
  context_summary: 'Недостаточно данных для анализа'
};

/**
 * Класс Analyst Agent
 * 
 * Анализирует контекст встречи и находит инсайты.
 */
export class AnalystAgent {
  private readonly llm: TextGenerationService;
  
  constructor(llmService?: TextGenerationService) {
    this.llm = llmService || new TextGenerationService();
  }
  
  /**
   * Проанализировать контекст встречи
   * 
   * @param input - входные данные с заметками, профилем, историей
   * @param signal - AbortSignal для отмены запроса
   * @returns анализ с инсайтами
   */
  async analyze(input: AnalystInput, signal?: AbortSignal): Promise<{ output: AnalystOutput; durationMs: number }> {
    const startTime = Date.now();
    
    // Проверяем отмену сразу
    if (signal?.aborted) {
      return {
        output: { ...DEFAULT_OUTPUT, context_summary: 'Запрос отменён' },
        durationMs: Date.now() - startTime
      };
    }
    
    // Быстрая проверка: если заметок нет или они слишком короткие
    if (!input.notes || input.notes.trim().length < 5) {
      return {
        output: {
          ...DEFAULT_OUTPUT,
          context_summary: `Встреча с ${input.employee.name}. Ожидаем заметки.`
        },
        durationMs: Date.now() - startTime
      };
    }
    
    try {
      const cfg = getLLMConfig();
      
      const systemPrompt = getAnalystSystemPrompt();
      const userPrompt = buildAnalystUserPrompt(input);
      
      const response = await this.llm.generateText({
        system: systemPrompt,
        prompt: userPrompt,
        model: cfg.pipelineModel || 'claude-sonnet-4-20250514',
        temperature: 0.4, // Низкая для аналитичности
        maxTokens: 2000,  // Достаточно для полного JSON с 5 инсайтами
        signal,
        timeoutMs: 8000   // Жёсткий таймаут 8 секунд на Analyst
      });
      
      const durationMs = Date.now() - startTime;
      const output = this.parseResponse(response.text, input.employee.name);
      
      return { output, durationMs };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Если отменено - возвращаем дефолт без лога ошибки
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          output: { ...DEFAULT_OUTPUT, context_summary: 'Запрос отменён' },
          durationMs
        };
      }
      
      console.error('[AnalystAgent] Ошибка:', error);
      
      return {
        output: {
          ...DEFAULT_OUTPUT,
          context_summary: `Встреча с ${input.employee.name}. Ошибка анализа.`
        },
        durationMs
      };
    }
  }
  
  /**
   * Парсинг JSON ответа от LLM
   */
  private parseResponse(text: string, employeeName: string): AnalystOutput {
    // Функция выделения и очистки JSON из ответа LLM
    const extractJson = (raw: string): string | null => {
      // 1) Ищем блок ```json ... ```
      const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
      if (fenced && fenced[1]) return fenced[1].trim();
      // 2) Ищем первый объект { ... }
      const brace = raw.match(/\{[\s\S]*\}/);
      if (brace && brace[0]) return brace[0].trim();
      return null;
    };
    
    // Очистка JSON от типичных ошибок LLM
    const cleanJson = (json: string): string => {
      return json
        // Убираем trailing commas перед } или ]
        .replace(/,\s*([\}\]])/g, '$1')
        // Убираем комментарии // ...
        .replace(/\/\/[^\n]*/g, '')
        // Убираем управляющие символы кроме \n \r \t
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    };
    
    // Попытка завершить обрезанный JSON
    const tryCompleteJson = (json: string): string => {
      let result = json.trim();
      
      // Если обрезано на середине строки, закрываем её
      const lastQuote = result.lastIndexOf('"');
      const afterLastQuote = result.slice(lastQuote + 1);
      // Если после последней кавычки нет закрывающей кавычки для значения
      if (lastQuote > 0 && !afterLastQuote.includes('"') && afterLastQuote.match(/^[^,\}\]]*$/)) {
        result += '"';
      }
      
      // Считаем незакрытые скобки
      let braces = 0, brackets = 0;
      let inString = false;
      for (let i = 0; i < result.length; i++) {
        const c = result[i];
        if (c === '"' && (i === 0 || result[i-1] !== '\\')) inString = !inString;
        if (!inString) {
          if (c === '{') braces++;
          if (c === '}') braces--;
          if (c === '[') brackets++;
          if (c === ']') brackets--;
        }
      }
      
      // Закрываем незакрытые структуры
      while (brackets > 0) { result += ']'; brackets--; }
      while (braces > 0) { result += '}'; braces--; }
      
      return result;
    };

    try {
      let jsonText = extractJson(text);
      if (!jsonText) {
        console.warn('[AnalystAgent] JSON не найден в ответе, пробуем весь текст');
        jsonText = text;
      }
      
      // DEBUG: логируем сырой JSON
      console.log('[AnalystAgent] Сырой JSON от LLM:\n', jsonText.slice(0, 2000));
      
      // Пробуем распарсить, если не получится - очищаем и пробуем снова
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e1) {
        console.log('[AnalystAgent] Первая попытка парсинга не удалась:', (e1 as Error).message);
        
        // Пробуем очистить
        const cleaned = cleanJson(jsonText);
        try {
          parsed = JSON.parse(cleaned);
        } catch (e2) {
          console.log('[AnalystAgent] Вторая попытка не удалась, пробуем завершить JSON');
          
          // Пробуем завершить обрезанный JSON
          const completed = tryCompleteJson(cleaned);
          console.log('[AnalystAgent] Завершённый JSON:\n', completed.slice(-500));
          parsed = JSON.parse(completed);
        }
      }
      
      // Валидация и нормализация insights
      const insights: AnalystInsight[] = [];
      if (Array.isArray(parsed.insights)) {
        for (const raw of parsed.insights.slice(0, 5)) { // Максимум 5
          const insight = this.parseInsight(raw);
          if (insight && insight.confidence >= 0.25) { // Снижен порог для большего отклика
            insights.push(insight);
          }
        }
      }
      
      // Валидация employee_state
      const employee_state = this.parseEmployeeState(parsed.employee_state);
      
      // Context summary
      const context_summary = typeof parsed.context_summary === 'string' 
        ? parsed.context_summary.slice(0, 300)
        : `Встреча с ${employeeName}.`;
      
      return { insights, employee_state, context_summary };
      
    } catch (error) {
      console.error('[AnalystAgent] Ошибка парсинга, fallback по сырому тексту:', error);
      // Фоллбек: используем сырой текст как интерпретацию, чтобы Decision мог ответить
      const fallbackInsight: AnalystInsight = {
        type: 'behavioral_tactic',
        interpretation: text.slice(0, 280) || 'Нужно обсудить поведение сотрудника',
        description: text.slice(0, 200),
        confidence: 0.35,
        evidence: [],
        relevance: 'medium'
      };
      return {
        insights: [fallbackInsight],
        employee_state: DEFAULT_OUTPUT.employee_state,
        context_summary: `Встреча с ${employeeName}. Черновик интерпретации по сырому ответу.`
      };
    }
  }
  
  /**
   * Парсинг и валидация одного инсайта
   */
  private parseInsight(raw: any): AnalystInsight | null {
    if (!raw || typeof raw !== 'object') return null;
    
    // Тип инсайта (новые + legacy типы)
    const validTypes: InsightType[] = [
      'behavioral_tactic', 'psychological_state', 'hidden_need', 'relationship_dynamic', 'risk',
      'pattern', 'opportunity', 'contradiction', 'trend' // legacy
    ];
    const type = validTypes.includes(raw.type) ? raw.type : 'pattern';
    
    // Интерпретация (новый формат) или описание (legacy)
    const interpretation = typeof raw.interpretation === 'string' 
      ? raw.interpretation.slice(0, 300) 
      : '';
    const description = typeof raw.description === 'string' 
      ? raw.description.slice(0, 200) 
      : interpretation; // Fallback на interpretation
    
    // Нужна хотя бы interpretation или description
    if (!interpretation && !description) return null;
    
    // Уверенность
    let confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.5;
    confidence = Math.max(0, Math.min(1, confidence)); // Clamp 0-1
    
    // Доказательства
    const evidence: string[] = Array.isArray(raw.evidence) 
      ? raw.evidence.filter((e: any) => typeof e === 'string').slice(0, 3)
      : [];
    
    // Связь с профилем (новое поле)
    const profile_connection = typeof raw.profile_connection === 'string'
      ? raw.profile_connection.slice(0, 200)
      : undefined;
    
    // Релевантность
    const validRelevance: RelevanceLevel[] = ['high', 'medium', 'low'];
    const relevance = validRelevance.includes(raw.relevance) ? raw.relevance : 'medium';
    
    return { type, interpretation, description, confidence, evidence, profile_connection, relevance };
  }
  
  /**
   * Парсинг и валидация состояния сотрудника
   */
  private parseEmployeeState(raw: any): EmployeeState {
    const defaultState: EmployeeState = {
      sentiment: 'unknown',
      engagement_level: 'medium',
      key_topics: []
    };
    
    if (!raw || typeof raw !== 'object') return defaultState;
    
    // Sentiment (добавлен hostile)
    const validSentiments: SentimentType[] = ['positive', 'neutral', 'negative', 'hostile', 'unknown'];
    const sentiment = validSentiments.includes(raw.sentiment) ? raw.sentiment : 'unknown';
    
    // Engagement (добавлен disengaged)
    const validEngagement: EngagementLevel[] = ['high', 'medium', 'low', 'disengaged'];
    const engagement_level = validEngagement.includes(raw.engagement_level) 
      ? raw.engagement_level 
      : 'medium';
    
    // Interaction mode (новое поле)
    const validModes: InteractionMode[] = ['constructive', 'defensive', 'aggressive', 'manipulative', 'withdrawn'];
    const interaction_mode = validModes.includes(raw.interaction_mode) 
      ? raw.interaction_mode 
      : undefined;
    
    // Topics
    const key_topics: string[] = Array.isArray(raw.key_topics)
      ? raw.key_topics.filter((t: any) => typeof t === 'string').slice(0, 5)
      : [];
    
    return { sentiment, engagement_level, interaction_mode, key_topics };
  }
}


