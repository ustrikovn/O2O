/**
 * Assistant Orchestrator
 * 
 * Координирует LLM Pipeline: Analyst → Decision → Composer
 * 
 * В Итерации 1: только Decision + базовая генерация
 * В Итерации 2: + Analyst
 * В Итерации 3: + Composer
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { buildAssistantContext, getPreviousMeetings } from './context.js';
import { AnalystAgent } from './agents/analyst.js';
import { DecisionAgent } from './agents/decision.js';
import { ComposerAgent } from './agents/composer.js';
import { PipelineLogger } from './agents/logger.js';
import { sessionKey, canRespondNow, shouldProcessNotesNow, wasSurveyOffered, markSurveyOffered } from './policies.js';
import type { AssistantMessagePayload, ActionCardPayload, PipelineLogPayload, PipelineLogLevel } from './types.js';
import type { DecisionInput, AnalystOutput, AnalystInput, ComposerInput, InterventionType } from './agents/types.js';

/** Callback для отправки логов клиенту */
export type OnPipelineLog = (log: PipelineLogPayload) => void;

/** Хранилище последних сообщений по сессии */
const recentMessagesMap = new Map<string, string[]>();

/** Время начала встречи по сессии */
const meetingStartTimeMap = new Map<string, number>();

/** Счётчик сообщений по сессии */
const messageCountMap = new Map<string, number>();

/** Активные AbortController для отмены запросов */
const activeControllers = new Map<string, AbortController>();

/** Общий timeout для всего pipeline (25 секунд) */
const PIPELINE_TOTAL_TIMEOUT_MS = 25_000;

/**
 * Orchestrator для LLM Pipeline
 */
export class AssistantOrchestrator {
  private readonly llm: TextGenerationService;
  private readonly analystAgent: AnalystAgent;
  private readonly decisionAgent: DecisionAgent;
  private readonly composerAgent: ComposerAgent;

  constructor() {
    this.llm = new TextGenerationService();
    this.analystAgent = new AnalystAgent(this.llm);
    this.decisionAgent = new DecisionAgent(this.llm);
    this.composerAgent = new ComposerAgent(this.llm);
  }

  /**
   * Обработка события от пользователя (user_message)
   */
  async handleUserEvent(params: {
    meetingId: string;
    employeeId: string;
    lastUserText?: string;
    lastNotes?: string;
    onLog?: OnPipelineLog;
  }): Promise<(AssistantMessagePayload | ActionCardPayload)[]> {
    const key = sessionKey(params.meetingId, params.employeeId);
    const log = params.onLog || (() => {});
    
    // Throttling
    if (!canRespondNow(key)) {
      log({ type: 'pipeline_log', level: 'info', stage: 'throttle', message: 'Пропуск: слишком частые запросы' });
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
      console.warn(`[Orchestrator] Pipeline timeout (${PIPELINE_TOTAL_TIMEOUT_MS}ms) для ${key}`);
      controller.abort();
    }, PIPELINE_TOTAL_TIMEOUT_MS);
    
    // Инициализация сессии
    if (!meetingStartTimeMap.has(key)) {
      meetingStartTimeMap.set(key, Date.now());
    }
    
    const logger = new PipelineLogger(params.meetingId, params.employeeId);
    logger.logStart(params.lastNotes || params.lastUserText);
    
    // Отправляем старт pipeline клиенту
    log({ 
      type: 'pipeline_log', 
      level: 'info', 
      stage: 'start', 
      message: `🚀 Pipeline запущен`,
      details: { input: (params.lastUserText || params.lastNotes || '').slice(0, 50) }
    });
    
    try {
      // Проверяем не отменён ли запрос
      if (controller.signal.aborted) {
        logger.logEnd('error', 'Отменено до начала');
        log({ type: 'pipeline_log', level: 'error', stage: 'abort', message: '⚠️ Отменено до начала' });
        return [];
      }
      
      const signal = controller.signal;
      
      // 1. Собираем контекст (с проверкой отмены)
      log({ type: 'pipeline_log', level: 'info', stage: 'context', message: '📋 Загрузка контекста...' });
      const context = await buildAssistantContext(params.meetingId, params.employeeId);
      if (signal.aborted) {
        logger.logEnd('error', 'Отменено при сборе контекста');
        log({ type: 'pipeline_log', level: 'error', stage: 'abort', message: '⚠️ Отменено при сборе контекста' });
        return [];
      }
      
      const previousMeetings = await getPreviousMeetings(params.employeeId, 5);
      if (signal.aborted) {
        logger.logEnd('error', 'Отменено при получении истории');
        log({ type: 'pipeline_log', level: 'error', stage: 'abort', message: '⚠️ Отменено при получении истории' });
        return [];
      }
      
      log({ 
        type: 'pipeline_log', 
        level: 'success', 
        stage: 'context', 
        message: `✅ Контекст загружен`,
        details: { 
          employee: context.employee.name,
          agreements: context.stats?.agreements_open || 0,
          history: previousMeetings.length
        }
      });
      
      // 2. Analyst — объединяем lastUserText и lastNotes
      const combinedNotes = [
        params.lastNotes,
        params.lastUserText ? `[Сообщение руководителя]: ${params.lastUserText}` : ''
      ].filter(Boolean).join('\n\n');
      
      const analystInput: AnalystInput = {
        notes: combinedNotes,
        employee: {
          id: context.employee.id,
          name: context.employee.name,
          position: context.employee.position,
          team: context.employee.team
        },
        characteristic: context.characteristic || null,
        previousMeetings: previousMeetings.map(m => ({
          date: m.date,
          notes: m.notes,
          satisfaction: m.satisfaction
        })),
        openAgreements: context.stats?.agreements_open || 0,
        agreementDetails: context.openAgreements?.map(a => ({
          title: a.title,
          responsible_type: a.responsible_type,
          status: a.status,
          due_date: a.due_date,
          days_ago: a.days_ago,
          weight: a.weight,
          is_overdue: a.is_overdue
        }))
      };
      
      log({ type: 'pipeline_log', level: 'info', stage: 'analyst', message: '🔍 Analyst анализирует...' });
      const { output: analysis, durationMs: analysisDuration } = await this.analystAgent.analyze(analystInput, signal);
      logger.logAnalyst(analysis, analysisDuration);
      
      log({ 
        type: 'pipeline_log', 
        level: 'success', 
        stage: 'analyst', 
        message: `✅ Analyst завершён`,
        durationMs: analysisDuration,
        details: { 
          insights: analysis.insights.length,
          sentiment: analysis.employee_state.sentiment,
          engagement: analysis.employee_state.engagement_level
        }
      });
      
      // Проверка отмены после Analyst
      if (signal.aborted) {
        logger.logEnd('error', 'Отменено после Analyst');
        log({ type: 'pipeline_log', level: 'error', stage: 'abort', message: '⚠️ Отменено после Analyst' });
        return [];
      }
      
      // 3. Decision
      log({ type: 'pipeline_log', level: 'info', stage: 'decision', message: '🤔 Decision принимает решение...' });
      const decisionInput = this.buildDecisionInput(key, analysis);
      const { output: decision, durationMs: decisionDuration } = await this.decisionAgent.decide(decisionInput, signal);
      logger.logDecision(decision, decisionDuration);
      
      // 4. Если Decision решил молчать
      if (!decision.should_intervene) {
        console.log(`[Orchestrator] Молчим. Причина: ${decision.reason}`);
        console.log(`[Orchestrator] Инсайтов: ${analysis.insights.length}, Sentiment: ${analysis.employee_state.sentiment}`);
        logger.logEnd('silence');
        log({ 
          type: 'pipeline_log', 
          level: 'warn', 
          stage: 'decision', 
          message: `🤫 Молчим: ${decision.reason.slice(0, 60)}...`,
          durationMs: decisionDuration
        });
        log({ type: 'pipeline_log', level: 'info', stage: 'end', message: '🏁 Pipeline завершён (молчим)' });
        return [];
      }
      
      log({ 
        type: 'pipeline_log', 
        level: 'success', 
        stage: 'decision', 
        message: `✅ Decision: вмешиваемся (${decision.intervention_type})`,
        durationMs: decisionDuration,
        details: { type: decision.intervention_type, priority: decision.priority }
      });
      
      // Проверка отмены после Decision
      if (signal.aborted) {
        logger.logEnd('error', 'Отменено после Decision');
        log({ type: 'pipeline_log', level: 'error', stage: 'abort', message: '⚠️ Отменено после Decision' });
        return [];
      }
      
      // 5. Composer
      log({ type: 'pipeline_log', level: 'info', stage: 'composer', message: '✍️ Composer генерирует ответ...' });
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
      
      const { output: composed, durationMs: composerDuration } = await this.composerAgent.compose(composerInput, signal);
      logger.logComposer(composed, composerDuration);
      
      log({ 
        type: 'pipeline_log', 
        level: 'success', 
        stage: 'composer', 
        message: `✅ Composer завершён`,
        durationMs: composerDuration
      });
      
      // 6. Формируем результат
      const messages: (AssistantMessagePayload | ActionCardPayload)[] = [];
      
      if (composed.message) {
        const text = this.trimTo280(composed.message.text);
        messages.push({ type: 'assistant_message', text });
        this.trackMessage(key, text);
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
      
      logger.logEnd('message');
      log({ 
        type: 'pipeline_log', 
        level: 'success', 
        stage: 'end', 
        message: `🏁 Pipeline завершён успешно!`,
        details: { messagesCount: messages.length }
      });
      return messages;
      
    } catch (error) {
      // Очищаем timeout и controller
      clearTimeout(timeoutId);
      activeControllers.delete(key);
      
      // Если это AbortError - не логируем как ошибку
      if (error instanceof Error && error.name === 'AbortError') {
        logger.logEnd('error', 'Запрос отменён (timeout или новый запрос)');
        log({ type: 'pipeline_log', level: 'warn', stage: 'abort', message: '⏱️ Запрос отменён (timeout)' });
        return [];
      }
      
      logger.logEnd('error', error instanceof Error ? error.message : 'Unknown error');
      console.error('[Orchestrator] Ошибка pipeline:', error);
      log({ 
        type: 'pipeline_log', 
        level: 'error', 
        stage: 'error', 
        message: `❌ Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
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
    onLog?: OnPipelineLog;
  }): Promise<AssistantMessagePayload[]> {
    const key = sessionKey(params.meetingId, params.employeeId);
    
    if (!shouldProcessNotesNow(key)) {
      return [];
    }
    
    const result = await this.handleUserEvent({
      meetingId: params.meetingId,
      employeeId: params.employeeId,
      lastNotes: params.notes,
      onLog: params.onLog
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
   * Обрезка текста до 500 символов (увеличено для формата с рекомендациями)
   */
  private trimTo280(text: string): string {
    const max = 500;
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
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
