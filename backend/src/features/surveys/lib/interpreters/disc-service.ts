import { Survey } from '@/shared/types/survey.js';
import { SurveyResultEntity } from '@/entities/survey/index.js';
import { 
  inferDiscLabelFromOpenAnswer, 
  inferDiscLabelForObstacle, 
  inferDiscLabelForDifficultInteraction,
  generateDiscDescription
} from './disc-llm.js';

type DiscLabel = 'D' | 'I' | 'S' | 'C';

interface DiscResultByQuestion {
  questionId: string;
  label: DiscLabel | null;
  model: string;
  rawText: string;
}

/**
 * Выполняет LLM-интерпретацию DISC для релевантных открытых ответов в результате опроса.
 * Мутирует metadata у переданного SurveyResultEntity (в память), но не сохраняет в БД.
 * 
 * Ищет вопросы по тегам:
 * - 'disc:leadership' — лидерство, инициатива
 * - 'disc:obstacle' — преодоление препятствий
 * - 'disc:difficult' — работа с трудными людьми
 */
export async function runDiscLLMForResult(params: {
  survey: Survey;
  resultEntity: SurveyResultEntity;
  modelOverride?: string;
}): Promise<void> {
  const { survey, resultEntity, modelOverride } = params;

  // 1) Находим целевые вопросы по тегам
  const leadershipQuestion = survey.questions.find(q =>
    (q.type === 'text' || q.type === 'textarea') &&
    q.tags?.includes('disc:leadership')
  );

  const obstacleQuestion = survey.questions.find(q =>
    (q.type === 'text' || q.type === 'textarea') &&
    q.tags?.includes('disc:obstacle')
  );

  const difficultQuestion = survey.questions.find(q =>
    (q.type === 'text' || q.type === 'textarea') &&
    q.tags?.includes('disc:difficult')
  );

  // 2) Сбор промисов для параллельного выполнения
  const llmPromises: Array<Promise<DiscResultByQuestion | null>> = [];

  if (leadershipQuestion) {
    const leadershipAnswer = resultEntity.getAnswer(leadershipQuestion.id);
    if (leadershipAnswer && typeof leadershipAnswer.value === 'string' && leadershipAnswer.value.trim().length > 0) {
      llmPromises.push(
        inferDiscLabelFromOpenAnswer(leadershipAnswer.value, modelOverride).then(({ label, model, rawText }) => ({
          questionId: leadershipQuestion.id,
          label: (label as DiscLabel | null),
          model,
          rawText
        }))
      );
    }
  }

  if (obstacleQuestion) {
    const obstacleAnswer = resultEntity.getAnswer(obstacleQuestion.id);
    if (obstacleAnswer && typeof obstacleAnswer.value === 'string' && obstacleAnswer.value.trim().length > 0) {
      llmPromises.push(
        inferDiscLabelForObstacle(obstacleAnswer.value, modelOverride).then(({ label, model, rawText }) => ({
          questionId: obstacleQuestion.id,
          label: (label as DiscLabel | null),
          model,
          rawText
        }))
      );
    }
  }

  if (difficultQuestion) {
    const difficultAnswer = resultEntity.getAnswer(difficultQuestion.id);
    if (difficultAnswer && typeof difficultAnswer.value === 'string' && difficultAnswer.value.trim().length > 0) {
      llmPromises.push(
        inferDiscLabelForDifficultInteraction(difficultAnswer.value, modelOverride).then(({ label, model, rawText }) => ({
          questionId: difficultQuestion.id,
          label: (label as DiscLabel | null),
          model,
          rawText
        }))
      );
    }
  }

  if (llmPromises.length === 0) {
    return; // Нечего интерпретировать
  }

  // 3) Выполняем запросы
  const llmResults = await Promise.all(llmPromises);

  // 4) Записываем результаты в metadata.disc
  if (!resultEntity.metadata) resultEntity.metadata = {};
  if (!resultEntity.metadata.disc) resultEntity.metadata.disc = {};
  if (!resultEntity.metadata.disc.byQuestionId) resultEntity.metadata.disc.byQuestionId = {};

  llmResults.forEach((res) => {
    if (!res || !res.label) return;

    resultEntity.metadata!.disc!.byQuestionId![res.questionId] = {
      llmLabel: res.label,
      model: res.model,
      createdAt: new Date().toISOString(),
      rawText: res.rawText
    };

    // Для лидерского вопроса — обратная совместимость: дублируем в корневые поля disc
    if (leadershipQuestion && res.questionId === leadershipQuestion.id) {
      resultEntity.metadata!.disc = {
        ...resultEntity.metadata!.disc,
        llmLabel: res.label,
        sourceQuestionId: res.questionId,
        model: res.model,
        createdAt: new Date().toISOString(),
        rawText: res.rawText
      };
    }
  });

  // 5) Рассчитываем суммарные баллы DISC по закрытым вопросам
  // Правило подсчёта:
  // - Каждой букве, сохранённой по результату опроса, присваивается 1 балл
  // - Для трёх последних вопросов, где присваиваются 2 буквы, каждой букве тоже +1
  // Реализация: для каждого ответа ищем либо traits/llmLabel в metadata.disc.byQuestionId,
  // либо извлекаем буквы напрямую из значения (для совместимости), и аккумулируем баллы
  const scoreMap: Record<'D' | 'I' | 'S' | 'C', number> = { D: 0, I: 0, S: 0, C: 0 };
  const byQuestion = resultEntity.metadata.disc.byQuestionId || {};

  for (const answer of resultEntity.answers) {
    const qMeta = byQuestion[answer.questionId];
    const letters: Array<'D' | 'I' | 'S' | 'C'> = [];
    // 1) Приоритет: traits (для закрытых вопросов)
    if (qMeta && Array.isArray(qMeta.traits) && qMeta.traits.length > 0) {
      for (const t of qMeta.traits) {
        if (t === 'D' || t === 'I' || t === 'S' || t === 'C') letters.push(t);
      }
    }
    // 2) Затем: llmLabel (для открытых)
    else if (qMeta && qMeta.llmLabel && (qMeta.llmLabel === 'D' || qMeta.llmLabel === 'I' || qMeta.llmLabel === 'S' || qMeta.llmLabel === 'C')) {
      letters.push(qMeta.llmLabel);
    }
    // 3) Фолбэк: извлечь буквы из значения ответа
    else {
      const valuesArray = Array.isArray(answer.value) ? answer.value : [answer.value];
      for (const v of valuesArray) {
        const s = String(v ?? '').trim().toUpperCase();
        if (!s) continue;
        if (s.length === 1 && (s === 'D' || s === 'I' || s === 'S' || s === 'C')) {
          if (!letters.includes(s as any)) letters.push(s as any);
          continue;
        }
        const extracted = s.replace(/[^DISC]/g, '').split('');
        for (const ch of extracted) {
          const mapped = ch === 'С' ? 'C' : ch; // поддержка кириллицы
          if ((mapped === 'D' || mapped === 'I' || mapped === 'S' || mapped === 'C') && !letters.includes(mapped as any)) {
            letters.push(mapped as any);
          }
        }
      }
    }
    // Начисляем по 1 баллу за каждую уникальную букву ответа
    for (const l of letters) {
      scoreMap[l] += 1;
    }
  }

  const totalScores = scoreMap.D + scoreMap.I + scoreMap.S + scoreMap.C;

  // 6) Формируем сухую интерпретацию и профильный хинт по правилам
  function levelLabel(score: number): string {
    if (score >= 6) return 'ярко выраженный тип';
    if (score >= 4) return 'умеренно выраженный тип';
    if (score >= 2) return 'слабо выраженный тип';
    return 'не характерно';
  }

  const parts: string[] = [];
  const order: Array<'D' | 'I' | 'S' | 'C'> = ['D', 'I', 'S', 'C'];
  for (const k of order) {
    const s = scoreMap[k];
    parts.push(`${s} балл${s === 1 ? '' : (s >= 2 && s <= 4 ? 'а' : 'ов')} ${k} — ${levelLabel(s)}`);
  }
  const summaryText = parts.join('. ');

  // Определяем профильный хинт
  const entries = order.map(k => ({ k, v: scoreMap[k] })).sort((a, b) => b.v - a.v);
  let profileHint = '';
  if (entries[0].v >= 6 && entries[0].v > entries[1].v) {
    profileHint = `Классический представитель типа ${entries[0].k}`;
  } else if (entries[0].v > 0 && Math.abs(entries[0].v - entries[1].v) <= 1) {
    profileHint = `Смешанный профиль (${entries[0].k}/${entries[1].k})`;
  } else {
    profileHint = 'Результаты неоднозначны — обратите внимание на открытые ответы и наблюдения';
  }

  resultEntity.metadata.disc.scores = { ...scoreMap, total: totalScores };
  resultEntity.metadata.disc.summaryText = summaryText;
  resultEntity.metadata.disc.profileHint = profileHint;

  // 7) Подготовим контекст ответов для LLM и запросим развёрнутое описание
  try {
    const questionMap = new Map(survey.questions.map(q => [q.id, q.title || q.id]));
    const lines: string[] = [];
    for (const a of resultEntity.answers) {
      const title = questionMap.get(a.questionId) || a.questionId;
      const valueText = Array.isArray(a.value) ? a.value.join(', ') : String(a.value ?? '');
      const qMeta = byQuestion[a.questionId];
      let lettersInfo = '';
      if (qMeta?.traits && Array.isArray(qMeta.traits) && qMeta.traits.length > 0) {
        lettersInfo = ` | буквы: ${qMeta.traits.join(', ')}`;
      } else if (qMeta?.llmLabel) {
        lettersInfo = ` | буква (LLM): ${qMeta.llmLabel}`;
      }
      lines.push(`- ${title}: ${valueText}${lettersInfo}`);
    }

    // Получаем команду и роль сотрудника для контекста, если доступны в metadata
    const employeeTeam = (resultEntity as any).employeeTeam || undefined;
    const employeeRole = (resultEntity as any).employeeRole || undefined;

    const { text, model } = await generateDiscDescription({
      scores: resultEntity.metadata.disc.scores,
      summaryText: resultEntity.metadata.disc.summaryText,
      profileHint: resultEntity.metadata.disc.profileHint,
      answersContext: lines.join('\n'),
      employeeTeam,
      employeeRole
    });

    resultEntity.metadata.disc.llmDescription = text;
    // при необходимости можно сохранить модель в корне disc
    if (text && !resultEntity.metadata.disc.model) {
      resultEntity.metadata.disc.model = model;
    }
  } catch (e) {
    // не валим пайплайн из-за описания
    console.error('DISC description LLM failed:', e);
  }
}


