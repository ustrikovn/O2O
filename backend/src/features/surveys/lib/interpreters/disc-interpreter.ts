import { QuestionAnswer, SurveyResult } from '../../../../shared/types/survey.js';

export type DiscTrait = 'D' | 'I' | 'S' | 'C';

export interface DiscInterpretation {
  counts: Record<DiscTrait, number>;
  totalAnswered: number; // кол-во обработанных ответов (вопросов)
  totalVotes: number; // суммарные «голоса» по типам (учитывает мульти-маппинг)
  primaryTraits: DiscTrait[];
  percentages: Record<DiscTrait, number>;
}

// Базовый маппинг: a→D, b→I, c→S, d→C
const choiceKeyToTrait: Record<string, DiscTrait> = {
  a: 'D',
  b: 'I',
  c: 'S',
  d: 'C'
};

// Маппинг для бинарных формулировок вопросов
// Примеры:
// - «Что дает вам больше энергии - работа с людьми или с задачами?» → люди = I/S, задачи = D/C
// - «Вы скорее активный инициатор или вдумчивый исполнитель?» → инициатор = D/I, исполнитель = S/C
// - «В стрессе вы скорее действуете быстро или обдумываете решения?» → быстро = D/I, обдумываю = S/C
const multiValueToTraits: Record<string, DiscTrait[]> = {
  // people vs tasks
  'люди': ['I', 'S'],
  'работа с людьми': ['I', 'S'],
  'с людьми': ['I', 'S'],
  people: ['I', 'S'],

  'задачи': ['D', 'C'],
  'работа с задачами': ['D', 'C'],
  'с задачами': ['D', 'C'],
  tasks: ['D', 'C'],

  // initiator vs executor
  'инициатор': ['D', 'I'],
  'активный инициатор': ['D', 'I'],
  initiator: ['D', 'I'],

  'исполнитель': ['S', 'C'],
  'вдумчивый исполнитель': ['S', 'C'],
  executor: ['S', 'C'],

  // fast vs thoughtful
  'быстро': ['D', 'I'],
  fast: ['D', 'I'],

  'обдумываю': ['S', 'C'],
  'обдуманно': ['S', 'C'],
  thoughtful: ['S', 'C']
};

function normalizeValueString(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/["'«».,!?()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveSingleTraitFromValue(rawValue: unknown): DiscTrait | null {
  if (rawValue == null) {
    return null;
  }

  if (Array.isArray(rawValue)) {
    for (const value of rawValue) {
      const trait = resolveSingleTraitFromValue(value);
      if (trait) {
        return trait;
      }
    }
    return null;
  }

  const valueAsString = String(rawValue).trim();
  if (valueAsString.length === 0) {
    return null;
  }

  const lower = valueAsString.toLowerCase();

  if (choiceKeyToTrait[lower as keyof typeof choiceKeyToTrait]) {
    return choiceKeyToTrait[lower as keyof typeof choiceKeyToTrait] ?? null;
  }

  // Разрешаем прямые буквы DISC
  const upper = valueAsString.toUpperCase();
  if (upper === 'D' || upper === 'I' || upper === 'S' || upper === 'C') {
    return upper as DiscTrait;
  }

  return null;
}

function resolveTraitsFromValue(rawValue: unknown): DiscTrait[] {
  if (rawValue == null) {
    return [];
  }

  // Если массив — собираем совокупность
  if (Array.isArray(rawValue)) {
    const traits: DiscTrait[] = [];
    for (const value of rawValue) {
      const nested = resolveTraitsFromValue(value);
      for (const t of nested) {
        if (!traits.includes(t)) traits.push(t);
      }
    }
    return traits;
  }

  const normalized = normalizeValueString(String(rawValue));
  if (normalized.length === 0) {
    return [];
  }

  // 1) Пытаемся найти бинарные текстовые маппинги
  const directMulti = multiValueToTraits[normalized as keyof typeof multiValueToTraits];
  if (directMulti && directMulti.length > 0) {
    return directMulti;
  }

  // 2) Пытаемся интерпретировать как один из базовых вариантов
  const single = resolveSingleTraitFromValue(normalized);
  return single ? [single] : [];
}

function computePercentages(counts: Record<DiscTrait, number>): Record<DiscTrait, number> {
  const totalVotes = Object.values(counts).reduce((acc, n) => acc + n, 0);
  if (totalVotes === 0) {
    return { D: 0, I: 0, S: 0, C: 0 };
  }
  return {
    D: Math.round((counts.D / totalVotes) * 1000) / 10,
    I: Math.round((counts.I / totalVotes) * 1000) / 10,
    S: Math.round((counts.S / totalVotes) * 1000) / 10,
    C: Math.round((counts.C / totalVotes) * 1000) / 10
  };
}

function findPrimaryTraits(counts: Record<DiscTrait, number>): DiscTrait[] {
  const max = Math.max(counts.D, counts.I, counts.S, counts.C);
  const traits: DiscTrait[] = [];
  if (counts.D === max) traits.push('D');
  if (counts.I === max) traits.push('I');
  if (counts.S === max) traits.push('S');
  if (counts.C === max) traits.push('C');
  return traits;
}

export function interpretDiscAnswers(answers: QuestionAnswer[]): DiscInterpretation {
  const counts: Record<DiscTrait, number> = { D: 0, I: 0, S: 0, C: 0 };
  let processedAnswers = 0;
  let totalVotes = 0;

  for (const answer of answers) {
    const traits = resolveTraitsFromValue(answer.value);
    if (traits.length === 0) {
      continue;
    }

    processedAnswers += 1;
    totalVotes += traits.length;
    for (const t of traits) {
      counts[t] = counts[t] + 1;
    }
  }

  const percentages = computePercentages(counts);
  const primaryTraits = findPrimaryTraits(counts);

  return {
    counts,
    totalAnswered: processedAnswers,
    totalVotes,
    primaryTraits,
    percentages
  };
}

export function interpretDiscFromResult(result: SurveyResult): DiscInterpretation {
  return interpretDiscAnswers(result.answers);
}


