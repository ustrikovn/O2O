import { Survey } from '@/shared/types/survey.js';
import { SurveyResultEntity } from '@/entities/survey/index.js';
import { generateBigFiveDescription } from './bigfive-llm.js';

type TraitKey = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

const traitIdPrefixes: Record<TraitKey, string> = {
  openness: 'op',
  conscientiousness: 'co',
  extraversion: 'ex',
  agreeableness: 'ag',
  neuroticism: 'ne'
};

// Вопросы с обратной шкалой (score' = 6 - score)
const reversedQuestions = new Set<string>([
  'op6', // Открытость
  'co5', // Добросовестность
  'ex4', 'ex8', // Экстраверсия
  'ag4', // Доброжелательность
  'ne3', 'ne5', 'ne8' // Нейротизм (низкий Н)
]);

function recodeIfNeeded(questionId: string, value: number): number {
  if (Number.isFinite(value) && reversedQuestions.has(questionId)) {
    return 6 - value; // инверсия 1↔5, 2↔4, 3↔3
  }
  return value;
}

function categoryLabel(avg: number): string {
  if (avg >= 4.0) return 'Черта выражена ярко';
  if (avg >= 3.0) return 'Умеренное проявление';
  if (avg >= 2.0) return 'Слабое проявление';
  return 'Практически отсутствует';
}

export async function runBigFiveSummaryForResult(params: {
  survey: Survey;
  resultEntity: SurveyResultEntity;
}): Promise<void> {
  const { survey, resultEntity } = params;

  const valuesByTrait: Record<TraitKey, number[]> = {
    openness: [],
    conscientiousness: [],
    extraversion: [],
    agreeableness: [],
    neuroticism: []
  };

  for (const answer of resultEntity.answers) {
    const qid = String(answer.questionId || '');
    const raw = Array.isArray(answer.value) ? Number(answer.value[0]) : Number(answer.value);
    if (!Number.isFinite(raw)) continue;

    const recoded = recodeIfNeeded(qid, raw);

    // По префиксу определяем черту
    if (qid.startsWith(traitIdPrefixes.openness)) valuesByTrait.openness.push(recoded);
    else if (qid.startsWith(traitIdPrefixes.conscientiousness)) valuesByTrait.conscientiousness.push(recoded);
    else if (qid.startsWith(traitIdPrefixes.extraversion)) valuesByTrait.extraversion.push(recoded);
    else if (qid.startsWith(traitIdPrefixes.agreeableness)) valuesByTrait.agreeableness.push(recoded);
    else if (qid.startsWith(traitIdPrefixes.neuroticism)) valuesByTrait.neuroticism.push(recoded);
  }

  function avgOf(arr: number[]): number {
    if (!arr || arr.length === 0) return 0;
    const v = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.round(v * 10) / 10; // до 1 знака
  }

  const averages = {
    openness: avgOf(valuesByTrait.openness),
    conscientiousness: avgOf(valuesByTrait.conscientiousness),
    extraversion: avgOf(valuesByTrait.extraversion),
    agreeableness: avgOf(valuesByTrait.agreeableness),
    neuroticism: avgOf(valuesByTrait.neuroticism)
  };

  const summaryLines = [
    `Открытость: ${averages.openness.toFixed(1)} — ${categoryLabel(averages.openness)}`,
    `Добросовестность: ${averages.conscientiousness.toFixed(1)} — ${categoryLabel(averages.conscientiousness)}`,
    `Экстраверсия: ${averages.extraversion.toFixed(1)} — ${categoryLabel(averages.extraversion)}`,
    `Доброжелательность: ${averages.agreeableness.toFixed(1)} — ${categoryLabel(averages.agreeableness)}`,
    `Нейротизм: ${averages.neuroticism.toFixed(1)} — ${categoryLabel(averages.neuroticism)}`
  ];

  if (!resultEntity.metadata) resultEntity.metadata = {};
  (resultEntity.metadata as any).bigFive = {
    averages,
    summaryText: summaryLines.join('. ')
  };

  // Попытка сгенерировать LLM-описание (не бросаем ошибку вверх)
  try {
    const questionMap = new Map(survey.questions.map(q => [q.id, q.title || q.id]));
    const lines: string[] = [];
    for (const a of resultEntity.answers) {
      const title = questionMap.get(a.questionId) || a.questionId;
      const val = Array.isArray(a.value) ? a.value[0] : a.value;
      const num = Number(val);
      const label = Number.isFinite(num)
        ? (num === 1 ? 'Не согласен' : num === 2 ? 'Скорее не согласен' : num === 3 ? 'Нейтрально' : num === 4 ? 'Скорее согласен' : num === 5 ? 'Согласен' : String(val))
        : String(val);
      lines.push(`- ${title}: ${val} (${label})`);
    }

    const { text, model } = await generateBigFiveDescription({
      averages,
      answersContext: lines.join('\n')
    });

    (resultEntity.metadata as any).bigFive.llmDescription = text;
    (resultEntity.metadata as any).bigFive.model = model;
  } catch (e) {
    // Логируем и продолжаем без падения
    console.error('Big Five LLM description failed:', e);
  }
}


