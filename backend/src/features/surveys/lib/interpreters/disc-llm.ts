import { TextGenerationService } from '@/shared/llm/textService.js';
import type { DiscTrait } from './disc-interpreter.js';

const SYSTEM_PROMPT =
  'Вы — нейромодель-ассессор, задача — интерпретировать открытые ответы сотрудника на ситуационные вопросы и соотносить их с индикаторами DISC (D — Доминирование, I — Влияние, S — Стабильность, C — Соответствие). Работайте на русском языке. Ответ должен содержать исключительно один из индикаторов DISC: D или I или S или С. Крайне важно чтобы это была одна из указанных букв и НИЧЕГО БОЛЬШЕ!';

const USER_PROMPT_BASE =
  'Проанализируй открытые ответы сотрудника на one-to-one и соотнеси их с индикаторами DISC по схеме вывода, не добавляя ничего вне JSON.\n\nИндикаторы для анализа:\nD: Фокус на результатах, быстрые решения, контроль процесса\nI: Упор на мотивацию команды, вовлечение людей, энтузиазм\nS: Акцент на командной работе, поддержке, постепенном движении\nC: Внимание к планированию, качеству, анализу рисков\n\nВозвращайте только валидный ответ строго по указанной схеме, без лишнего текста.';

const USER_PROMPT_OBSTACLE =
  'Проанализируй открытые ответы сотрудника на one-to-one и соотнеси их с индикаторами DISC по схеме вывода, не добавляя ничего вне JSON.\n\nИндикаторы для анализа:\nD: Агрессивный подход, быстрые действия, преодоление "в лоб"\nI: Поиск поддержки, использование связей, позитивный настрой\nS: Терпеливое решение, поиск помощи, постепенное преодоление\nC: Системный анализ, поиск корневых причин, методичный подход\n\nВозвращайте только валидный ответ строго по указанной схеме, без лишнего текста.';

const USER_PROMPT_DIFFICULT =
  'Проанализируй открытые ответы сотрудника на one-to-one и соотнеси их с индикаторами DISC по схеме вывода, не добавляя ничего вне JSON.\n\nИндикаторы для анализа:\nD: Прямая конфронтация, установление границ, требование результатов\nI: Попытки наладить отношения, поиск общих интересов, харизма\nS: Терпение, понимание, постепенное построение доверия\nC: Фокус на фактах, структурированный подход, избегание эмоций\n\nВозвращайте только валидный ответ строго по указанной схеме, без лишнего текста.';

function normalizeDiscLetter(raw: string): DiscTrait | null {
  if (!raw) return null;
  // Извлекаем первую букву из множества D,I,S,C (учитываем кириллицу С/с)
  const firstChar = raw.trim().charAt(0);
  if (!firstChar) return null;
  const upper = firstChar.toUpperCase();
  // Приводим кириллическую С к латинской C
  const mapped = upper === 'С' ? 'C' : upper;
  if (mapped === 'D' || mapped === 'I' || mapped === 'S' || mapped === 'C') {
    return mapped as DiscTrait;
  }
  // Попробуем найти символ внутри строки, если первый символ не подходит
  const match = raw.toUpperCase().match(/[DISСC]/); // С — кириллица, C — латиница
  if (!match) return null;
  const m = match[0] === 'С' ? 'C' : match[0];
  return (m === 'D' || m === 'I' || m === 'S' || m === 'C') ? (m as DiscTrait) : null;
}

export async function inferDiscLabelFromOpenAnswer(answerText: string, modelOverride?: string): Promise<{ label: DiscTrait | null; rawText: string; model: string }>
{
  const tg = new TextGenerationService();
  const userPrompt = `${USER_PROMPT_BASE}\n\nОткрытый ответ сотрудника: "${answerText}"`;
  const { text, model } = await tg.generateText({
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    model: modelOverride || 'gpt-4o'
  });
  const label = normalizeDiscLetter(text);
  return { label, rawText: text, model };
}

export async function inferDiscLabelForObstacle(answerText: string, modelOverride?: string): Promise<{ label: DiscTrait | null; rawText: string; model: string }>
{
  const tg = new TextGenerationService();
  const userPrompt = `${USER_PROMPT_OBSTACLE}\n\nОткрытый ответ сотрудника: "${answerText}"`;
  const { text, model } = await tg.generateText({
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    model: modelOverride || 'gpt-4o'
  });
  const label = normalizeDiscLetter(text);
  return { label, rawText: text, model };
}

export async function inferDiscLabelForDifficultInteraction(answerText: string, modelOverride?: string): Promise<{ label: DiscTrait | null; rawText: string; model: string }>
{
  const tg = new TextGenerationService();
  const userPrompt = `${USER_PROMPT_DIFFICULT}\n\nОткрытый ответ сотрудника: "${answerText}"`;
  const { text, model } = await tg.generateText({
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    model: modelOverride || 'gpt-4o'
  });
  const label = normalizeDiscLetter(text);
  return { label, rawText: text, model };
}


