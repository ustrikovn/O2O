/**
 * Assistant Orchestrator
 * 
 * Координирует LLM Pipeline с двухэтапным анализом:
 * 
 * 1. ImmediateAnalyst — быстрый анализ "здесь и сейчас" (без истории)
 * 2. Если нет совета → DeepAnalyst — глубокий анализ с историей
 * 3. ProfileDeviationAgent — поиск отклонений от профиля/истории
 * 4. Decision — решение говорить или молчать
 * 5. Composer — генерация сообщения
 * 
 * Также включает:
 * - Debounce 3 секунды перед анализом
 * - Проверка минимума новых слов (5 слов)
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { buildAssistantContext, getPreviousMeetings } from './context.js';
import { AnalystAgent } from './agents/analyst.js';
import { ImmediateAnalystAgent } from './agents/immediate-analyst.js';
import { DecisionAgent } from './agents/decision.js';
import { ComposerAgent } from './agents/composer.js';
import { ProfileDeviationAgent } from './agents/profile-deviation.js';
import { PipelineLogger } from './agents/logger.js';
import { ASSISTANT_CONFIG } from './config.js';
import { 
  sessionKey, 
  canRespondNow, 
  shouldAnalyze,
  hasEnoughNewWords,
  markTextAtRecommendation,
  wasSurveyOffered, 
  markSurveyOffered 
} from './policies.js';
import { createDebugLog, addAgentCall, setDebugOutput } from './debug-store.js';
import { getImmediateAnalystSystemPrompt, buildImmediateAnalystUserPrompt } from './prompts/immediate-analyst.prompt.js';
import { getAnalystSystemPrompt, buildAnalystUserPrompt } from './prompts/analyst.prompt.js';
import { getProfileDeviationSystemPrompt, buildProfileDeviationUserPrompt } from './prompts/profile-deviation.prompt.js';
import { getDecisionSystemPrompt, buildDecisionUserPrompt } from './prompts/decision.prompt.js';
import { getComposerSystemPrompt, buildComposerUserPrompt } from './prompts/composer.prompt.js';
import type { AssistantMessagePayload, ActionCardPayload, DeviationCardPayload } from './types.js';
import type { 
  DecisionInput, 
  AnalystOutput, 
  AnalystInput, 
  ComposerInput, 
  InterventionType,
  ImmediateAnalystInput,
  ProfileDeviationInput
} from './agents/types.js';

/** Получить базовый URL для debug ссылок */
function getDebugBaseUrl(): string {
  return process.env.API_BASE_URL || 'http://localhost:3001';
}

/** Хранилище последних сообщений по сессии */
const recentMessagesMap = new Map<string, string[]>();

/** Время начала встречи по сессии */
const meetingStartTimeMap = new Map<string, number>();

/** Счётчик сообщений по сессии */
const messageCountMap = new Map<string, number>();

/** Активные AbortController для отмены запросов */
const activeControllers = new Map<string, AbortController>();

/**
 * Orchestrator для LLM Pipeline
 */
export class AssistantOrchestrator {
  private readonly llm: TextGenerationService;
  private readonly immediateAnalystAgent: ImmediateAnalystAgent;
  private readonly deepAnalystAgent: AnalystAgent;
  private readonly decisionAgent: DecisionAgent;
  private readonly composerAgent: ComposerAgent;
  private readonly profileDeviationAgent: ProfileDeviationAgent;

  constructor() {
    this.llm = new TextGenerationService();
    this.immediateAnalystAgent = new ImmediateAnalystAgent(this.llm);
    this.deepAnalystAgent = new AnalystAgent(this.llm);
    this.decisionAgent = new DecisionAgent(this.llm);
    this.composerAgent = new ComposerAgent(this.llm);
    this.profileDeviationAgent = new ProfileDeviationAgent(this.llm);
  }

  /**
   * Обработка события от пользователя (user_message)
   */
  async handleUserEvent(params: {
    meetingId: string;
    employeeId: string;
    lastUserText?: string;
    lastNotes?: string;
    onLog?: (log: any) => void;
  }): Promise<(AssistantMessagePayload | ActionCardPayload | DeviationCardPayload)[]> {
    const key = sessionKey(params.meetingId, params.employeeId);
    
    // Throttling
    if (!canRespondNow(key)) {
      return [];
    }
    
    // Отмена предыдущего запроса если он ещё выполняется
    const existingController = activeControllers.get(key);
    if (existingController) {
      console.log(`[Orchestrator] Отмена предыдущего запроса для ${key}`);
      existingController.abort();
    }
    
    // Создаём новый AbortController
    const controller = new AbortController();
    activeControllers.set(key, controller);
    
    // Устанавливаем общий timeout на весь pipeline
    const timeoutId = setTimeout(() => {
      console.warn(`[Orchestrator] Pipeline timeout (${ASSISTANT_CONFIG.timeouts.pipelineTotal}ms) для ${key}`);
      controller.abort();
    }, ASSISTANT_CONFIG.timeouts.pipelineTotal);
    
    // Инициализация сессии
    if (!meetingStartTimeMap.has(key)) {
      meetingStartTimeMap.set(key, Date.now());
    }
    
    const logger = new PipelineLogger(params.meetingId, params.employeeId, params.onLog);
    logger.logStart(params.lastNotes || params.lastUserText);
    
    // Создаём debug-лог для этого запроса
    let debugId: string | null = null;
    const pipelineStartTime = Date.now();
    
    try {
      // Проверяем не отменён ли запрос
      if (controller.signal.aborted) {
        logger.logEnd('error', 'Отменено до начала');
        return [];
      }
      
      const signal = controller.signal;
      
      // 1. Собираем контекст
      const context = await buildAssistantContext(params.meetingId, params.employeeId);
      if (signal.aborted) {
        logger.logEnd('error', 'Отменено при сборе контекста');
        return [];
      }
      
      // Объединяем заметки
      const combinedNotes = [
        params.lastNotes,
        params.lastUserText ? `[Сообщение руководителя]: ${params.lastUserText}` : ''
      ].filter(Boolean).join('\n\n');
      
      // Инициализируем debug-лог
      debugId = createDebugLog({
        meetingId: params.meetingId,
        employeeId: params.employeeId,
        employeeName: context.employee.name,
        notes: combinedNotes,
        ...(context.characteristic ? { characteristic: context.characteristic } : {})
      });
      
      // 2. ImmediateAnalyst — быстрый анализ "здесь и сейчас"
      const immediateInput: ImmediateAnalystInput = {
        notes: combinedNotes,
        employee: {
          id: context.employee.id,
          name: context.employee.name,
          ...(context.employee.position ? { position: context.employee.position } : {}),
          ...(context.employee.team ? { team: context.employee.team } : {})
        },
        characteristic: context.characteristic || null
      };
      
      const { output: immediateResult, durationMs: immediateDuration } = 
        await this.immediateAnalystAgent.analyze(immediateInput, signal);
      
      console.log(`[Orchestrator] ImmediateAnalyst (${immediateDuration}ms): has_advice=${immediateResult.has_actionable_advice}, needs_deep=${immediateResult.needs_deep_analysis}`);
      logger.logCustom('immediate_analyst', {
        has_advice: immediateResult.has_actionable_advice,
        needs_deep: immediateResult.needs_deep_analysis,
        reason: immediateResult.reason
      }, immediateDuration);
      
      // Debug: сохраняем вызов ImmediateAnalyst
      if (debugId) {
        addAgentCall(debugId, {
          agent: 'ImmediateAnalyst',
          systemPrompt: getImmediateAnalystSystemPrompt(),
          userPrompt: buildImmediateAnalystUserPrompt(immediateInput),
          rawResponse: JSON.stringify(immediateResult, null, 2),
          parsedResponse: immediateResult,
          durationMs: immediateDuration
        });
      }
      
      if (signal.aborted) {
        logger.logEnd('error', 'Отменено после ImmediateAnalyst');
        return [];
      }
      
      // Переменная для финального анализа
      let analysis: AnalystOutput;
      let usedDeepAnalysis = false;
      
      // 3. Если ImmediateAnalyst нашёл совет — используем его
      if (immediateResult.has_actionable_advice && immediateResult.insight) {
        // Конвертируем в формат AnalystOutput для Decision
        analysis = {
          insights: [immediateResult.insight],
          employee_state: {
            sentiment: 'unknown',
            engagement_level: 'medium',
            key_topics: []
          },
          context_summary: immediateResult.situation_summary
        };
        console.log('[Orchestrator] Используем результат ImmediateAnalyst');
      } 
      // 4. Иначе — запускаем DeepAnalyst с историей
      else if (immediateResult.needs_deep_analysis) {
        console.log('[Orchestrator] Запускаем DeepAnalyst с историей...');
        
        const previousMeetings = await getPreviousMeetings(params.employeeId, 5);
        if (signal.aborted) {
          logger.logEnd('error', 'Отменено при получении истории');
          return [];
        }
        
        const deepInput: AnalystInput = {
          notes: combinedNotes,
          employee: {
            id: context.employee.id,
            name: context.employee.name,
            ...(context.employee.position ? { position: context.employee.position } : {}),
            ...(context.employee.team ? { team: context.employee.team } : {})
          },
          characteristic: context.characteristic || null,
          previousMeetings: previousMeetings.map(m => ({
            date: m.date,
            ...(m.notes ? { notes: m.notes } : {}),
            ...(m.satisfaction !== undefined ? { satisfaction: m.satisfaction } : {})
          })),
          openAgreements: context.stats?.agreements_open || 0,
          ...(context.openAgreements ? {
            agreementDetails: context.openAgreements.map(a => ({
              title: a.title,
              responsible_type: a.responsible_type,
              status: a.status,
              ...(a.due_date ? { due_date: a.due_date } : {}),
              days_ago: a.days_ago,
              weight: a.weight,
              is_overdue: a.is_overdue
            }))
          } : {})
        };
        
        const { output: deepAnalysis, durationMs: deepDuration } = 
          await this.deepAnalystAgent.analyze(deepInput, signal);
        
        logger.logAnalyst(deepAnalysis, deepDuration);
        analysis = deepAnalysis;
        usedDeepAnalysis = true;
        
        // Debug: сохраняем вызов DeepAnalyst
        if (debugId) {
          addAgentCall(debugId, {
            agent: 'DeepAnalyst',
            systemPrompt: getAnalystSystemPrompt(),
            userPrompt: buildAnalystUserPrompt(deepInput),
            rawResponse: JSON.stringify(deepAnalysis, null, 2),
            parsedResponse: deepAnalysis,
            durationMs: deepDuration
          });
        }
        
        if (signal.aborted) {
          logger.logEnd('error', 'Отменено после DeepAnalyst');
          return [];
        }
      }
      // 5. Нет ни совета, ни нужды в глубоком анализе — молчим
      else {
        console.log(`[Orchestrator] Молчим. Причина от ImmediateAnalyst: ${immediateResult.reason}`);
        
        // Сохраняем результат в debug-лог
        if (debugId) {
          setDebugOutput(debugId, {
            decision: 'silence',
            messages: [],
            reason: `ImmediateAnalyst: ${immediateResult.reason}`
          }, Date.now() - pipelineStartTime);
        }
        
        logger.logEnd('silence');
        return [];
      }
      
      // 6. ProfileDeviationAgent — проверка на отклонения
      let deviationMessage: DeviationCardPayload | null = null;
      
      if (usedDeepAnalysis) {
        const previousMeetings = await getPreviousMeetings(params.employeeId, 5);
        
        const deviationInput: ProfileDeviationInput = {
          current_behavior: analysis.context_summary,
          current_topics: analysis.employee_state.key_topics,
          current_sentiment: analysis.employee_state.sentiment,
          ...(analysis.employee_state.interaction_mode ? { current_interaction_mode: analysis.employee_state.interaction_mode } : {}),
          profile: context.characteristic || null,
          employee: {
            id: context.employee.id,
            name: context.employee.name,
            ...(context.employee.position ? { position: context.employee.position } : {})
          },
          previousMeetings: previousMeetings.map(m => ({
            date: m.date,
            ...(m.notes ? { notes: m.notes } : {}),
            ...(m.satisfaction !== undefined ? { satisfaction: m.satisfaction } : {})
          }))
        };
        
        const { output: deviationResult, durationMs: deviationDuration } = 
          await this.profileDeviationAgent.analyze(deviationInput, signal);
        
        console.log(`[Orchestrator] ProfileDeviation (${deviationDuration}ms): has_deviation=${deviationResult.has_deviation}`);
        logger.logCustom('profile_deviation', {
          has_deviation: deviationResult.has_deviation,
          type: deviationResult.deviation_type,
          severity: deviationResult.severity
        }, deviationDuration);
        
        // Debug: сохраняем вызов ProfileDeviation
        if (debugId) {
          addAgentCall(debugId, {
            agent: 'ProfileDeviation',
            systemPrompt: getProfileDeviationSystemPrompt(),
            userPrompt: buildProfileDeviationUserPrompt(deviationInput),
            rawResponse: JSON.stringify(deviationResult, null, 2),
            parsedResponse: deviationResult,
            durationMs: deviationDuration
          });
        }
        
        // Если найдено отклонение — создаём карточку
        if (deviationResult.has_deviation && deviationResult.message) {
          const deviationCard: DeviationCardPayload = {
            type: 'action_card',
            card: {
              id: `deviation-${params.employeeId}-${Date.now()}`,
              kind: 'profile_deviation',
              title: '⚠️ Обнаружено отклонение',
              subtitle: deviationResult.message,
              severity: deviationResult.severity || 'significant',
              deviation_type: deviationResult.deviation_type || 'history_anomaly'
            }
          };
          
          // Добавляем cta только если есть рекомендация
          if (deviationResult.recommended_action) {
            deviationCard.card.cta = {
              label: 'Подробнее',
              action: 'showDeviation',
              params: { 
                explanation: deviationResult.explanation,
                recommendation: deviationResult.recommended_action
              }
            };
          }
          
          deviationMessage = deviationCard;
        }
      }
      
      // 7. Decision — решение говорить или молчать
      const decisionInput = this.buildDecisionInput(key, analysis);
      const { output: decision, durationMs: decisionDuration } = 
        await this.decisionAgent.decide(decisionInput, signal);
      logger.logDecision(decision, decisionDuration);
      
      // Debug: сохраняем вызов Decision
      if (debugId) {
        addAgentCall(debugId, {
          agent: 'Decision',
          systemPrompt: getDecisionSystemPrompt(),
          userPrompt: buildDecisionUserPrompt(decisionInput),
          rawResponse: JSON.stringify(decision, null, 2),
          parsedResponse: decision,
          durationMs: decisionDuration
        });
      }
      
      // 8. Если Decision решил молчать
      if (!decision.should_intervene) {
        console.log(`[Orchestrator] Молчим. Причина: ${decision.reason}`);
        console.log(`[Orchestrator] Инсайтов: ${analysis.insights.length}, Sentiment: ${analysis.employee_state.sentiment}`);
        
        // Сохраняем результат в debug-лог
        if (debugId) {
          setDebugOutput(debugId, {
            decision: 'silence',
            messages: deviationMessage ? [deviationMessage] : [],
            reason: decision.reason
          }, Date.now() - pipelineStartTime);
        }
        
        // Но если есть отклонение — всё равно показываем его
        if (deviationMessage) {
          logger.logEnd('deviation_only');
          return [deviationMessage];
        }
        
        logger.logEnd('silence');
        return [];
      }
      
      // Проверка отмены после Decision
      if (signal.aborted) {
        logger.logEnd('error', 'Отменено после Decision');
        return [];
      }
      
      // 9. Composer — генерация сообщения
      const insight = analysis.insights[decision.insight_index || 0];
      const composerInput: ComposerInput = {
        intervention_type: (decision.intervention_type || 'insight') as InterventionType,
        insight: insight || {
          type: 'pattern',
          interpretation: analysis.context_summary,
          description: analysis.context_summary,
          confidence: 0.5,
          evidence: [],
          relevance: 'medium'
        },
        employee_name: context.employee.name,
        context_summary: analysis.context_summary
      };
      
      const { output: composed, durationMs: composerDuration } = 
        await this.composerAgent.compose(composerInput, signal);
      logger.logComposer(composed, composerDuration);
      
      // Debug: сохраняем вызов Composer
      if (debugId) {
        addAgentCall(debugId, {
          agent: 'Composer',
          systemPrompt: getComposerSystemPrompt(composerInput.intervention_type),
          userPrompt: buildComposerUserPrompt(composerInput),
          rawResponse: JSON.stringify(composed, null, 2),
          parsedResponse: composed,
          durationMs: composerDuration
        });
      }
      
      // 10. Формируем результат
      const messages: (AssistantMessagePayload | ActionCardPayload | DeviationCardPayload)[] = [];
      const debugUrl = debugId ? `${getDebugBaseUrl()}/api/assistant/debug/${debugId}/view` : undefined;
      
      if (composed.message) {
        let text = composed.message.text;
        
        // Добавляем ссылку на debug в текст сообщения
        if (debugUrl) {
          text = `${text}\n\n🔍 Debug: ${debugUrl}`;
        }
        
        const messagePayload: AssistantMessagePayload = { 
          type: 'assistant_message', 
          text
        };
        if (debugUrl) {
          messagePayload.debugUrl = debugUrl;
        }
        messages.push(messagePayload);
        this.trackMessage(key, text);
        
        // Сохраняем текст заметок на момент рекомендации
        markTextAtRecommendation(key, combinedNotes);
      }
      
      if (composed.action_card) {
        const card: ActionCardPayload['card'] = {
          id: `${composed.action_card.kind}-${params.employeeId}`,
          kind: composed.action_card.kind as any,
          title: composed.action_card.title,
          cta: composed.action_card.cta
        };
        if (composed.action_card.subtitle) {
          card.subtitle = composed.action_card.subtitle;
        }
        messages.push({ type: 'action_card', card });
      }
      
      // Добавляем карточку отклонения если есть
      if (deviationMessage) {
        messages.push(deviationMessage);
      }
      
      // Проверка на предложение опроса
      if (!wasSurveyOffered(key) && this.shouldSuggestSurvey(context)) {
        messages.push({
          type: 'action_card',
          card: {
            id: `survey-${params.employeeId}`,
            kind: 'start_survey',
            title: 'Предложить пройти опрос',
            subtitle: 'Поможет обогатить профиль сотрудника',
            cta: { label: 'Открыть опрос', action: 'openSurvey', params: { employeeId: params.employeeId } }
          }
        });
        markSurveyOffered(key);
      }
      
      // Сохраняем результат в debug-лог
      if (debugId) {
        setDebugOutput(debugId, {
          decision: 'message',
          messages,
          reason: decision.reason
        }, Date.now() - pipelineStartTime);
      }
      
      logger.logEnd('message');
      return messages;
      
    } catch (error) {
      // Очищаем timeout и controller
      clearTimeout(timeoutId);
      activeControllers.delete(key);
      
      // Если это AbortError - не логируем как ошибку
      if (error instanceof Error && error.name === 'AbortError') {
        logger.logEnd('error', 'Запрос отменён (timeout или новый запрос)');
        return [];
      }
      
      logger.logEnd('error', error instanceof Error ? error.message : 'Unknown error');
      console.error('[Orchestrator] Ошибка pipeline:', error);
      return [];
    } finally {
      // Гарантированно очищаем timeout и controller
      clearTimeout(timeoutId);
      activeControllers.delete(key);
    }
  }

  /**
   * Обработка обновления заметок (notes_update)
   */
  async handleNotesEvent(params: { 
    meetingId: string; 
    employeeId: string; 
    notes: string;
    onLog?: (log: any) => void;
  }): Promise<AssistantMessagePayload[]> {
    const key = sessionKey(params.meetingId, params.employeeId);
    
    // Проверяем ВСЕ условия: debounce + минимум новых слов
    const analyzeCheck = shouldAnalyze(key, params.notes);
    if (!analyzeCheck.should) {
      console.log(`[Orchestrator] Пропускаем анализ: ${analyzeCheck.reason}`);
      return [];
    }
    
    const result = await this.handleUserEvent({
      meetingId: params.meetingId,
      employeeId: params.employeeId,
      lastNotes: params.notes,
      ...(params.onLog ? { onLog: params.onLog } : {})
    });
    
    return result.filter((m): m is AssistantMessagePayload => m.type === 'assistant_message');
  }

  /**
   * Формирование входных данных для Decision
   */
  private buildDecisionInput(key: string, analysis: AnalystOutput): DecisionInput {
    const startTime = meetingStartTimeMap.get(key) || Date.now();
    const durationMinutes = Math.floor((Date.now() - startTime) / 60000);
    const messageCount = messageCountMap.get(key) || 0;
    const recentMessages = recentMessagesMap.get(key) || [];
    
    return {
      analysis,
      context: {
        meeting_duration_minutes: durationMinutes,
        messages_sent_this_session: messageCount
      },
      recentAssistantMessages: recentMessages.slice(-3) // Последние 3 сообщения
    };
  }

  /**
   * Отслеживание отправленных сообщений
   */
  private trackMessage(key: string, text: string): void {
    const messages = recentMessagesMap.get(key) || [];
    messages.push(text);
    if (messages.length > 10) messages.shift(); // Храним максимум 10
    recentMessagesMap.set(key, messages);
    
    const count = (messageCountMap.get(key) || 0) + 1;
    messageCountMap.set(key, count);
  }


  /**
   * Проверка нужен ли опрос
   */
  private shouldSuggestSurvey(ctx: any): boolean {
    const text = (ctx?.characteristic as string | null) || null;
    if (!text) return true;
    return text.trim().length < 120;
  }
}
