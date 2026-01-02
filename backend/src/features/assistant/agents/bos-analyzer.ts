/**
 * BOS Analyzer Agent
 * 
 * Задача: анализ поведения сотрудника на one-to-one встрече
 * по методике Behavioral Observation Scale (BOS).
 * 
 * Оценивает 12 поведений по шкале 1-5 на основе заметок и договорённостей.
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
import { getBOSAnalyzerSystemPrompt, buildBOSAnalyzerUserPrompt } from '../prompts/bos-analyzer.prompt.js';
import type {
  BOSAnalysisInput,
  BOSAnalysisOutput,
  BOSScores,
  BOSScore,
  BOSBehaviorKey
} from './bos-types.js';
import { BOS_BEHAVIOR_KEYS as BEHAVIOR_KEYS } from './bos-types.js';

/** Пустой результат BOS (все null) */
function getEmptyScores(): BOSScores {
  const scores: Partial<BOSScores> = {};
  for (const key of BEHAVIOR_KEYS) {
    scores[key] = { score: null, evidence: null };
  }
  return scores as BOSScores;
}

/**
 * Класс BOS Analyzer Agent
 */
export class BOSAnalyzerAgent {
  private readonly llm: TextGenerationService;

  constructor(llmService?: TextGenerationService) {
    this.llm = llmService || new TextGenerationService();
  }

  /**
   * Провести BOS-анализ встречи
   * 
   * @param input - входные данные: заметки + договорённости
   * @returns результат анализа с оценками по 12 поведениям
   */
  async analyze(input: BOSAnalysisInput): Promise<{ output: BOSAnalysisOutput; durationMs: number }> {
    const startTime = Date.now();

    // Проверка: есть ли данные для анализа
    const hasNotes = input.notes && input.notes.trim().length > 10;
    const hasAgreements = input.agreements && input.agreements.length > 0;

    if (!hasNotes && !hasAgreements) {
      console.log('[BOSAnalyzerAgent] Недостаточно данных для анализа');
      return {
        output: { scores: getEmptyScores() },
        durationMs: Date.now() - startTime
      };
    }

    try {
      const cfg = getLLMConfig();

      const systemPrompt = getBOSAnalyzerSystemPrompt();
      const userPrompt = buildBOSAnalyzerUserPrompt(input);

      console.log(`[BOSAnalyzerAgent] Запуск анализа для встречи ${input.meetingId}`);

      const response = await this.llm.generateText({
        system: systemPrompt,
        prompt: userPrompt,
        model: cfg.pipelineModel || 'claude-sonnet-4-20250514',
        temperature: 0.2, // Низкая для объективности
        maxTokens: 2500,  // Достаточно для полного JSON с 12 оценками
        timeoutMs: 30000  // 30 секунд на анализ
      });

      const durationMs = Date.now() - startTime;
      const output = this.parseResponse(response.text);

      console.log(`[BOSAnalyzerAgent] Анализ завершён за ${durationMs}ms`);

      return { output, durationMs };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error('[BOSAnalyzerAgent] Ошибка:', error);

      // Возвращаем пустой результат при ошибке
      return {
        output: { scores: getEmptyScores() },
        durationMs
      };
    }
  }

  /**
   * Парсинг JSON ответа от LLM
   */
  private parseResponse(text: string): BOSAnalysisOutput {
    // Извлечение JSON из ответа
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
        // Убираем управляющие символы
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    };

    try {
      let jsonText = extractJson(text);
      if (!jsonText) {
        console.warn('[BOSAnalyzerAgent] JSON не найден в ответе');
        return { scores: getEmptyScores() };
      }

      // Пробуем распарсить
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        // Пробуем очистить и снова
        const cleaned = cleanJson(jsonText);
        parsed = JSON.parse(cleaned);
      }

      // Валидация и нормализация scores
      const scores = this.validateScores(parsed.scores);

      return { scores };

    } catch (error) {
      console.error('[BOSAnalyzerAgent] Ошибка парсинга JSON:', error);
      return { scores: getEmptyScores() };
    }
  }

  /**
   * Валидация и нормализация оценок
   */
  private validateScores(rawScores: any): BOSScores {
    const scores = getEmptyScores();

    if (!rawScores || typeof rawScores !== 'object') {
      return scores;
    }

    for (const key of BEHAVIOR_KEYS) {
      const raw = rawScores[key];
      if (!raw || typeof raw !== 'object') {
        continue;
      }

      // Валидация score
      let score: number | null = null;
      if (raw.score !== null && raw.score !== undefined) {
        const numScore = Number(raw.score);
        if (!isNaN(numScore) && numScore >= 1 && numScore <= 5) {
          score = Math.round(numScore); // Округляем до целого
        }
      }

      // Валидация evidence
      let evidence: string | null = null;
      if (score !== null && typeof raw.evidence === 'string' && raw.evidence.trim()) {
        evidence = raw.evidence.trim().slice(0, 200); // Ограничиваем длину
      }

      scores[key] = { score, evidence };
    }

    return scores;
  }
}


