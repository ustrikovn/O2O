import { TextGenerationService } from '@/shared/llm/textService.js';
import { getLLMConfig } from '@/shared/config/llm.js';

const cfg = getLLMConfig();
const BIGFIVE_MODEL = cfg.bigFiveModel || cfg.defaultModel || 'gpt-4o';

const SYSTEM = (
  'Вы — опытный HR Business Partner и организационный психолог. На основе результатов Big Five составьте прикладное описание профиля сотрудника для руководителя. ' +
  'Пишите на русском языке, профессионально и нейтрально. Избегайте медицинских/психиатрических трактовок, моральных оценок, категоричных формулировок. ' +
  'Не делайте выводов о способностях, IQ или этичности. Не давайте кадровых рекомендаций (уволить/понизить). Используйте исключительно предоставленные данные.'
);

const FORMAT = (
  'Формат вывода (строго, Markdown):\n' +
  '1) Поведенческий профиль (4–6 предложений)\n' +
  '2) Портрет по пяти чертам (по 2–3 пункта на каждую черту)\n' +
  '3) Сильные стороны (4–7 пунктов)\n' +
  '4) Риски и триггеры (4–6 пунктов)\n' +
  '5) Рекомендации руководителю (7–10 пунктов)\n' +
  'Требования: 350–600 слов, ясная структура, короткие абзацы и маркеры.'
);

export async function generateBigFiveDescription(params: {
  averages: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number };
  answersContext: string;
  employeeTeam?: string | undefined;
  employeeRole?: string | undefined;
  modelOverride?: string | undefined;
}): Promise<{ text: string; model: string }> {
  const tg = new TextGenerationService();

  function labelFor(v: number): string {
    if (v >= 4.0) return 'Черта выражена ярко';
    if (v >= 3.0) return 'Умеренное проявление';
    if (v >= 2.0) return 'Слабое проявление';
    return 'Практически отсутствует';
  }

  const aggregates = `# Профиль Big Five (агрегаты)\n` +
    `Открытость: ${params.averages.openness.toFixed(1)} — ${labelFor(params.averages.openness)}\n` +
    `Добросовестность: ${params.averages.conscientiousness.toFixed(1)} — ${labelFor(params.averages.conscientiousness)}\n` +
    `Экстраверсия: ${params.averages.extraversion.toFixed(1)} — ${labelFor(params.averages.extraversion)}\n` +
    `Доброжелательность: ${params.averages.agreeableness.toFixed(1)} — ${labelFor(params.averages.agreeableness)}\n` +
    `Нейротизм: ${params.averages.neuroticism.toFixed(1)} — ${labelFor(params.averages.neuroticism)}\n`;

  const prompt = `${aggregates}\n\n# Ответы (вопрос → 1–5 + словесная шкала)\n${params.answersContext}\n\n# Контекст роли/команды (если есть)\nКоманда: ${params.employeeTeam || '-'}\nРоль: ${params.employeeRole || '-'}\n\nСформируй вывод строго по разделам из Формата.`;

  const { text, model } = await tg.generateText({
    system: SYSTEM + '\n\n' + FORMAT,
    prompt,
    model: params.modelOverride || BIGFIVE_MODEL,
    temperature: 0.5,
    maxTokens: 2000,
    topP: 0.9,
    presencePenalty: 0.2
  });

  return { text, model };
}


