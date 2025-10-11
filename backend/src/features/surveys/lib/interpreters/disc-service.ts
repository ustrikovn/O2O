import { Survey } from '@/shared/types/survey.js';
import { SurveyResultEntity } from '@/entities/survey/index.js';
import { 
  inferDiscLabelFromOpenAnswer, 
  inferDiscLabelForObstacle, 
  inferDiscLabelForDifficultInteraction 
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
}


