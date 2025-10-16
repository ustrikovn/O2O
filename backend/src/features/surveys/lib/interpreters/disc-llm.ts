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

// Генерация развёрнутого описания DISC-профиля на основе контекста и правил интерпретации
export async function generateDiscDescription(params: {
  scores: { D: number; I: number; S: number; C: number; total: number } | undefined;
  summaryText: string | undefined;
  profileHint: string | undefined;
  answersContext: string; // Полный контекст: вопросы, ответы, присвоенные буквы, правила интерпретации
  employeeTeam?: string | undefined;
  employeeRole?: string | undefined;
  modelOverride?: string | undefined;
}): Promise<{ text: string; model: string }> {
  const tg = new TextGenerationService();
  const cfg = getLLMConfig();
  const model = cfg.discModel || cfg.defaultModel || 'gpt-4o';

  const system = (
    '# Роль и экспертиза\n' +
    'Ты — senior HR Business Partner с 10+ летним опытом работы и специализацией в организационной психологии. Ты эксперт в интерпретации DISC-оценок и их применении для развития команд.\n\n' +
    '# Контекст задачи\n' +
    'Ты получишь результаты DISC-опроса сотрудника в формате вопросов и предоставленных на них ответов, а также баллов D, I, S, С и результатов их подсчета. Твоя задача — создать профессиональную характеристику, которая поможет руководителю эффективно управлять этим сотрудником.\n\n' +
    '# Требования к выводу\n\n' +
    '## Структура (обязательная):\n' +
    '1. **Поведенческий профиль** (2-3 предложения): Краткое описание доминирующих DISC-черт и их проявление в работе\n' +
    '2. **Стиль работы и коммуникации** (3-4 предложения): Как сотрудник принимает решения, взаимодействует с командой, реагирует на изменения\n' +
    '3. **Мотивация и демотивация** (4-5 пунктов):\n' +
    '   - Что мотивирует: [список факторов]\n' +
    '   - Что демотивирует: [список факторов]\n' +
    '4. **Рекомендации руководителю** (3-4 предложения): Конкретные советы по коммуникации и постановке задач\n' +
    '5. **Оптимальные и неоптимальные роли** (отдельный блок):\n' +
    '   - Подходящие роли: [2-3 роли с обоснованием через DISC-черты]\n' +
    '   - Неподходящие роли: [2-3 роли с объяснением рисков]\n\n' +
    '## Формат вывода (строго соблюдай) указанную Markdown-разметку \n\n' +
    '## Стиль и тон:\n' +
    '- Профессиональный, но доступный язык (избегай психологического жаргона)\n' +
    '- Конструктивный тон (фокус на сильных сторонах + осознание ограничений)\n' +
    '- Избегай категоричных суждений ("никогда", "всегда")\n' +
    '- Используй конкретные примеры поведения вместо абстрактных характеристик\n\n' +
    '# Критически важные ограничения (ОБЯЗАТЕЛЬНО соблюдай):\n\n' +
    '- Длина: 250-500 слов\n' +
    '- НЕ используй термины "хороший/плохой сотрудник"\n' +
    '- НЕ делай медицинских или психиатрических заключений\n' +
    '- Помни: DISC описывает поведенческие предпочтения, НЕ способности или IQ\n\n' +
    '1. **Валидность DISC**: \n' +
    '   - Помни: DISC показывает ПОВЕДЕНЧЕСКИЕ ПРЕДПОЧТЕНИЯ, не способности\n' +
    '   - НЕ делай выводы о: интеллекте, креативности, лидерском потенциале, этичности\n' +
    '   - Используй формулировки: "склонен", "предпочитает", "вероятно", избегай "всегда", "никогда"\n\n' +
    '2. **Этика и законность**:\n' +
    '   - НЕ упоминай: возраст, пол, национальность, внешность\n' +
    '   - НЕ делай медицинских/психиатрических заключений\n' +
    '   - НЕ рекомендуй увольнение или понижение\n\n' +
    '3. **Проверка фактов**:\n' +
    '   - Каждое утверждение должно логически следовать из DISC-данных\n' +
    '   - Если данных недостаточно для вывода, напиши: "На основе доступных DISC-данных сложно судить о [аспект]"\n\n' +
    '4. **Откат при неопределенности**:\n' +
    '   - Если DISC-профиль сбалансированный (все показатели 40-60), укажи: "Профиль демонстрирует гибкость и адаптивность. Рекомендуется дополнительная оценка или интервью для точных рекомендаций."'
  );
  const prompt = '';

  const contextParts: string[] = [];
  if (params.employeeTeam) contextParts.push(`Команда: ${params.employeeTeam}`);
  if (params.employeeRole) contextParts.push(`Роль: ${params.employeeRole}`);
  if (params.scores) contextParts.push(`Баллы DISC: D=${params.scores.D}, I=${params.scores.I}, S=${params.scores.S}, C=${params.scores.C} (итого=${params.scores.total})`);
  if (params.summaryText) contextParts.push(`Сухая интерпретация: ${params.summaryText}`);
  if (params.profileHint) contextParts.push(`Профиль: ${params.profileHint}`);
  contextParts.push('Ответы и присвоенные буквы:\n' + params.answersContext);

  const { text, model: usedModel } = await tg.generateText({
    system,
    prompt,
    context: contextParts.join('\n'),
    model: params.modelOverride || model,
    maxTokens: 600,
    temperature: 0.5
  });

  return { text, model: usedModel };
}


