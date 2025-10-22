import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
import { buildAssistantContext } from './context.js';
import { buildSystemPrompt, buildUserPrompt } from './llm-prompt.js';
import { extractJsonIfAny } from './json-extractor.js';
import { sessionKey, canRespondNow, shouldProcessNotesNow, wasSurveyOffered, markSurveyOffered } from './policies.js';
import type { AssistantMessagePayload, ActionCardPayload } from './types.js';

export class AssistantOrchestrator {
  private readonly llm: TextGenerationService;

  constructor() {
    this.llm = new TextGenerationService();
  }

  async handleUserEvent(params: {
    meetingId: string;
    employeeId: string;
    lastUserText?: string;
    lastNotes?: string;
  }): Promise<(AssistantMessagePayload | ActionCardPayload)[]> {
    const key = sessionKey(params.meetingId, params.employeeId);
    if (!canRespondNow(key)) return [];

    const context = await buildAssistantContext(params.meetingId, params.employeeId);
    const contextCompact = this.compactContext(context);

    const system = buildSystemPrompt();
    const promptInput: { contextCompact: string; lastUserText?: string; lastNotes?: string } = { contextCompact };
    if (params.lastUserText !== undefined) {
      promptInput.lastUserText = params.lastUserText;
    }
    if (params.lastNotes !== undefined) {
      promptInput.lastNotes = params.lastNotes;
    }
    const prompt = buildUserPrompt(promptInput);

    const cfg = getLLMConfig();
    const res = await this.llm.generateText({
      system,
      prompt,
      model: cfg.assistantModel || cfg.defaultModel,
      temperature: 0.5,
      maxTokens: 300
    });

    const text = res.text?.trim() || '';
    const extracted = extractJsonIfAny(text);

    const messages: (AssistantMessagePayload | ActionCardPayload)[] = [];
    if (extracted.plain) {
      messages.push({ type: 'assistant_message', text: this.trimTo420(extracted.plain) });
    }

    // Политика: предложить опрос один раз за встречу, если профиль пуст/бедный
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

    return messages;
  }

  async handleNotesEvent(params: { meetingId: string; employeeId: string; notes: string }): Promise<AssistantMessagePayload[]> {
    const key = sessionKey(params.meetingId, params.employeeId);
    if (!shouldProcessNotesNow(key)) return [];
    const base = { meetingId: params.meetingId, employeeId: params.employeeId } as const;
    const result = await this.handleUserEvent({ ...base, lastNotes: params.notes });
    return result.filter((m): m is AssistantMessagePayload => m.type === 'assistant_message');
  }

  private trimTo420(text: string): string {
    const max = 420;
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  private compactContext(ctx: any): string {
    const parts: string[] = [];
    parts.push(`Сотрудник: ${ctx.employee.name} (${ctx.employee.position || ''}/${ctx.employee.team || ''})`);
    if (ctx.meeting) {
      parts.push(`Встреча: ${ctx.meeting.id}, статус=${ctx.meeting.status}`);
      if (ctx.meeting.notes) parts.push(`Краткие заметки: ${String(ctx.meeting.notes).slice(0, 200)}`);
    }
    if (typeof ctx.stats?.agreements_open === 'number') parts.push(`Открытых договоренностей: ${ctx.stats.agreements_open}`);
    if (ctx.characteristic) parts.push(`Характеристика: ${String(ctx.characteristic).slice(0, 200)}`);
    return parts.join(' | ');
  }

  private shouldSuggestSurvey(ctx: any): boolean {
    const text = (ctx?.characteristic as string | null) || null;
    if (!text) return true;
    // Очень короткая характеристика — считаем профиль бедным
    return text.trim().length < 120;
  }
}


