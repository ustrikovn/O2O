/**
 * Сидирование опроса "Большая пятёрка (Big Five)" в базу данных
 * Вставляет 2 блока (Открытость, Добросовестность) по 8 утверждений каждый — формат rating 1–5.
 * Остальные блоки (Экстраверсия, Доброжелательность, Нейротизм) будут добавлены позже.
 */

import { connectDatabase, closeDatabase, query } from '@/shared/database/connection.js';
import { SurveyService, SurveyRepository } from '@/features/surveys/index.js';
import { CreateSurveyDto } from '@/shared/types/survey.js';
import { pool } from '@/shared/database/connection.js';

function buildBigFiveSurveyDto(): CreateSurveyDto {
  // Секции: только 2 на текущем этапе
  const sections = [
    {
      id: 'openness',
      title: 'Открытость к опыту',
      description: 'Любознательность, креативность и интерес к новому'
    },
    {
      id: 'conscientiousness',
      title: 'Добросовестность',
      description: 'Организованность, дисциплина, надёжность'
    }
  ];

  // Общие настройки шкалы 1–5
  const scale = {
    min: 1,
    max: 5,
    step: 1,
    minLabel: 'Совершенно не согласен',
    maxLabel: 'Полностью согласен'
  };

  // Вопросы — блок 1: Открытость (8 шт.)
  const opennessQuestions = [
    { id: 'op1', title: 'Мне интересно пробовать новые методы работы, даже если они непривычны.' },
    { id: 'op2', title: 'Я предпочитаю разнообразные задачи однообразным.' },
    { id: 'op3', title: 'Мне нравится изучать смежные области или расширять знания вне текущей роли.' },
    { id: 'op4', title: 'Я быстро нахожу нестандартные решения проблем.' },
    { id: 'op5', title: 'Я чувствую скуку, когда всё предсказуемо и без новых идей.' },
    { id: 'op6', title: 'Мне комфортнее следовать проверенной методике (обратная формулировка).' },
    { id: 'op7', title: 'Я стараюсь видеть возможности для улучшения в любых рабочих процессах.' },
    { id: 'op8', title: 'Люди часто называют мои подходы креативными.' }
  ].map((q) => ({
    id: q.id,
    type: 'rating' as const,
    title: q.title,
    required: true,
    section: 'openness',
    scale
  }));

  // Вопросы — блок 2: Добросовестность (8 шт.)
  const conscientiousnessQuestions = [
    { id: 'co1', title: 'Я всегда стараюсь доводить задачи до конца, даже если приходится задерживаться.' },
    { id: 'co2', title: 'Мне важно, чтобы работа была выполнена точно и в срок.' },
    { id: 'co3', title: 'Я редко забываю о своих обязательствах.' },
    { id: 'co4', title: 'Я склонен составлять детальные планы.' },
    { id: 'co5', title: 'Импровизация лучше, чем следование плану (обратная формулировка).' },
    { id: 'co6', title: 'Коллеги могут на меня положиться в важных вопросах.' },
    { id: 'co7', title: 'Мне нравится ставить приоритеты и действовать по чек‑листу.' },
    { id: 'co8', title: 'Я предпочитаю порядок и структуру даже в мелочах.' }
  ].map((q) => ({
    id: q.id,
    type: 'rating' as const,
    title: q.title,
    required: true,
    section: 'conscientiousness',
    scale
  }));

  // Последовательная навигация по вопросам
  const questions = [...opennessQuestions, ...conscientiousnessQuestions];
  for (let i = 0; i < questions.length - 1; i++) {
    (questions[i] as any).nextQuestion = questions[i + 1].id;
  }

  const logic = {
    startQuestion: questions[0].id,
    endPoints: [questions[questions.length - 1].id]
  } as const;

  const dto: CreateSurveyDto = {
    title: 'Большая пятёрка (Big Five)',
    description:
      'Оценка пяти ключевых личностных черт: Открытость, Добросовестность, Экстраверсия, Доброжелательность, Нейротизм. На текущем этапе содержатся два блока — Открытость и Добросовестность.',
    questions,
    logic,
    settings: {
      allowBack: true,
      showProgress: true,
      savePartialResults: true
    },
    metadata: {
      category: 'personality',
      estimatedDuration: 10,
      author: 'System',
      tags: ['big-five', 'personality', 'v1'],
      version: '1.0.0',
      sections
    }
  };

  return dto;
}

async function addBigFiveSurvey(): Promise<void> {
  await connectDatabase();

  // Проверяем, есть ли уже Big Five по тегу или по названию
  const exists = await query(
    `SELECT id FROM surveys WHERE title ILIKE $1 OR ($2 = ANY(tags)) LIMIT 1`,
    ['%Большая пятёрка%', 'big-five']
  );

  if (exists.rows.length > 0) {
    console.log('ℹ️ Опрос "Большая пятёрка" уже существует. Пропускаем создание.');
    return;
  }

  const surveyRepository = new SurveyRepository(pool);
  const surveyService = new SurveyService(surveyRepository);

  const dto = buildBigFiveSurveyDto();
  const created = await surveyService.createSurvey(dto);

  console.log('✅ Опрос "Большая пятёрка" создан:', { id: created.id, title: created.title });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  addBigFiveSurvey()
    .then(() => closeDatabase())
    .then(() => {
      console.log('🎉 Сидирование Big Five завершено');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ошибка сидирования Big Five:', err);
      closeDatabase().finally(() => process.exit(1));
    });
}

export { addBigFiveSurvey };


