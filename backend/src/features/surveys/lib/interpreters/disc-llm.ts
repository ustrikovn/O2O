import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';
type DiscTrait = 'D' | 'I' | 'S' | 'C';

// Для сложной DISC-интерпретации используем модель из конфига (LLM_DISC_MODEL || LLM_DEFAULT_MODEL)
const cfg = getLLMConfig();
const DISC_INTERPRETATION_MODEL = cfg.discModel || cfg.defaultModel || 'gpt-4o';

const SYSTEM_PROMPT =
  'Вы — нейромодель-ассессор, задача — интерпретировать открытые ответы сотрудника на ситуационные вопросы и соотносить их с индикаторами DISC (D — Доминирование, I — Влияние, S — Стабильность, C — Соответствие). Работайте на русском языке. Ответ должен содержать ИСКЛЮЧИТЕЛЬНО ОДНУ ЛАТИНСКУЮ БУКВУ: D или I или S или C. НИЧЕГО БОЛЬШЕ — никакого текста, пояснений, знаков препинания.';

// Общая структура user-промпта
const PROMPT_TEMPLATE = {
  intro: 'Проанализируй открытые ответы сотрудника на one-to-one и соотнеси их с индикаторами DISC.',
  indicatorsHeader: '\n\nИндикаторы для анализа:',
  outro: '\n\nВозвращай ТОЛЬКО ОДНУ БУКВУ из списка: D, I, S или C. Никакого дополнительного текста!'
};

// Вариативные индикаторы для каждого типа вопроса
const DISC_INDICATORS = {
  leadership: `
D: Фокус на результатах, быстрые решения, контроль процесса
I: Упор на мотивацию команды, вовлечение людей, энтузиазм
S: Акцент на командной работе, поддержке, постепенном движении
C: Внимание к планированию, качеству, анализу рисков`,
  
  obstacle: `
D: Агрессивный подход, быстрые действия, преодоление "в лоб"
I: Поиск поддержки, использование связей, позитивный настрой
S: Терпеливое решение, поиск помощи, постепенное преодоление
C: Системный анализ, поиск корневых причин, методичный подход`,
  
  difficult: `
D: Прямая конфронтация, установление границ, требование результатов
I: Попытки наладить отношения, поиск общих интересов, харизма
S: Терпение, понимание, постепенное построение доверия
C: Фокус на фактах, структурированный подход, избегание эмоций`
};

// Сборщик промпта
function buildUserPrompt(context: keyof typeof DISC_INDICATORS): string {
  return `${PROMPT_TEMPLATE.intro}${PROMPT_TEMPLATE.indicatorsHeader}\n${DISC_INDICATORS[context]}${PROMPT_TEMPLATE.outro}`;
}

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

// Единая базовая функция интерпретации DISC
async function interpretDiscAnswer(
  answerText: string,
  context: keyof typeof DISC_INDICATORS,
  modelOverride?: string
): Promise<{ label: DiscTrait | null; rawText: string; model: string }> {
  const tg = new TextGenerationService();
  const userPrompt = `${buildUserPrompt(context)}\n\nОткрытый ответ сотрудника: "${answerText}"`;
  const { text, model } = await tg.generateText({
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    model: modelOverride || DISC_INTERPRETATION_MODEL
  });
  const label = normalizeDiscLetter(text);
  return { label, rawText: text, model };
}

// Экспортируемые функции для каждого типа вопроса
export async function inferDiscLabelFromOpenAnswer(answerText: string, modelOverride?: string): Promise<{ label: DiscTrait | null; rawText: string; model: string }> {
  return interpretDiscAnswer(answerText, 'leadership', modelOverride);
}

export async function inferDiscLabelForObstacle(answerText: string, modelOverride?: string): Promise<{ label: DiscTrait | null; rawText: string; model: string }> {
  return interpretDiscAnswer(answerText, 'obstacle', modelOverride);
}

export async function inferDiscLabelForDifficultInteraction(answerText: string, modelOverride?: string): Promise<{ label: DiscTrait | null; rawText: string; model: string }> {
  return interpretDiscAnswer(answerText, 'difficult', modelOverride);
}


