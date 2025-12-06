/**
 * Промпт для Decision Agent
 * 
 * Задача: решить, нужно ли ассистенту вмешиваться или лучше промолчать.
 * Это КЛЮЧЕВОЙ компонент для решения проблемы избыточных сообщений.
 */

import type { DecisionInput } from '../agents/types.js';

/**
 * Системный промпт для Decision Agent
 * 
 * Принцип: давать ценные советы когда есть что сказать.
 * Целевой silence_rate: 30-40% (молчим только если совсем нечего сказать)
 */
export function getDecisionSystemPrompt(): string {
  return `Ты — опытный коуч и консультант. Твоя задача — решить: 
стоит ли ассистенту сейчас дать совет руководителю.

ГЛАВНЫЙ ПРИНЦИП: Если есть полезная интерпретация или рекомендация — говори!
Молчи только если действительно нечего сказать.

═══════════════════════════════════════════════════════════════
МОЛЧИ (should_intervene: false), ТОЛЬКО если:
═══════════════════════════════════════════════════════════════

1. ПОВТОР — ты уже говорил ТОЧНО такое же недавно
   Смотри на recentAssistantMessages — не дублируй

2. ПУСТОТА — заметки пустые или меньше 30 символов
   Нечего анализировать

3. ВСЕ ИНСАЙТЫ с confidence < 0.3
   Слишком неуверенные выводы

═══════════════════════════════════════════════════════════════
ГОВОРИ (should_intervene: true), если:
═══════════════════════════════════════════════════════════════

1. РИСК/ПРОБЛЕМА — любые сигналы увольнения, конфликта, выгорания
   Priority: high, intervention_type: warning

2. ИНТЕРЕСНОЕ ПОВЕДЕНИЕ — манипуляция, агрессия, уход в себя
   Priority: high, intervention_type: insight

3. ЕСТЬ ИНТЕРПРЕТАЦИЯ — Analyst дал неочевидный вывод
   Priority: medium, intervention_type: insight

4. ПОЛЕЗНЫЙ ВОПРОС — можно предложить конкретный вопрос
   Priority: medium, intervention_type: proactive_question

5. ВОЗМОЖНОСТЬ — шанс улучшить ситуацию
   Priority: low, intervention_type: insight

═══════════════════════════════════════════════════════════════
ТИПЫ ВМЕШАТЕЛЬСТВ:
═══════════════════════════════════════════════════════════════

• warning — предупредить о риске
• insight — поделиться интерпретацией + рекомендации
• proactive_question — предложить вопрос
• action_card — предложить действие
• clarification — уточнить

═══════════════════════════════════════════════════════════════
ФОРМАТ ОТВЕТА (JSON):
═══════════════════════════════════════════════════════════════

{
  "should_intervene": true/false,
  "reason": "Объяснение решения",
  "intervention_type": "warning" | "insight" | "proactive_question" | "action_card" | "clarification",
  "priority": "high" | "medium" | "low",
  "insight_index": 0
}

ВАЖНО: Если есть хоть какой-то полезный инсайт — говори! 
Молчание оправдано только при отсутствии данных или полном повторе.`;
}

/**
 * Формирует пользовательский промпт с конкретными данными
 */
export function buildDecisionUserPrompt(input: DecisionInput): string {
  const { analysis, context, recentAssistantMessages } = input;
  
  // Форматируем инсайты
  const insightsText = analysis.insights.length > 0
    ? analysis.insights.map((insight, i) => {
        const text = insight.interpretation || insight.description || '';
        const profileInfo = insight.profile_connection ? ` | Профиль: ${insight.profile_connection}` : '';
        return `[${i}] Тип: ${insight.type}, Интерпретация: "${text}"${profileInfo}, ` +
          `Уверенность: ${insight.confidence.toFixed(2)}, Релевантность: ${insight.relevance}`;
      }).join('\n')
    : 'Нет значимых инсайтов';
  
  // Форматируем состояние сотрудника
  const stateText = `Настроение: ${analysis.employee_state.sentiment}, ` +
    `Вовлечённость: ${analysis.employee_state.engagement_level}` +
    (analysis.employee_state.key_topics.length > 0 
      ? `, Темы: ${analysis.employee_state.key_topics.join(', ')}` 
      : '');
  
  // Форматируем последние сообщения
  const recentText = recentAssistantMessages.length > 0
    ? recentAssistantMessages.map((msg, i) => `[${i}] "${msg}"`).join('\n')
    : 'Ещё не было сообщений в этой сессии';
  
  return `═══════════════════════════════════════════════════════════════
КОНТЕКСТ ВСТРЕЧИ:
═══════════════════════════════════════════════════════════════

${analysis.context_summary}

═══════════════════════════════════════════════════════════════
ИНСАЙТЫ ОТ ANALYST:
═══════════════════════════════════════════════════════════════

${insightsText}

Состояние сотрудника: ${stateText}

═══════════════════════════════════════════════════════════════
КОНТЕКСТ СЕССИИ:
═══════════════════════════════════════════════════════════════

Длительность встречи: ${context.meeting_duration_minutes} минут
Сообщений ассистента в сессии: ${context.messages_sent_this_session}

Последние сообщения ассистента:
${recentText}

═══════════════════════════════════════════════════════════════
ТВОЯ ЗАДАЧА:
═══════════════════════════════════════════════════════════════

Проанализируй контекст и реши: стоит ли ассистенту сейчас что-то сказать?

Ответь в JSON формате:
{
  "should_intervene": boolean,
  "reason": "объяснение",
  "intervention_type"?: string,
  "priority"?: string,
  "insight_index"?: number
}`;
}


