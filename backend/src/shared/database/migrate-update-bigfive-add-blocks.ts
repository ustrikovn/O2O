/**
 * Обновление опроса "Большая пятёрка (Big Five)": добавление блоков 3–5
 * Блоки: Экстраверсия, Доброжелательность, Нейротизм (эмоциональная устойчивость)
 * Формат: rating 1–5, последовательный переход по вопросам, финальная точка — ne8
 */

import { connectDatabase, closeDatabase, query } from '@/shared/database/connection.js';
import { SurveyService, SurveyRepository } from '@/features/surveys/index.js';
import { UpdateSurveyDto, CreateSurveyDto } from '@/shared/types/survey.js';
import { pool } from '@/shared/database/connection.js';

const scale = {
  min: 1,
  max: 5,
  step: 1,
  minLabel: 'Не согласен',
  maxLabel: 'Согласен'
} as const;

function buildAllSectionsQuestions() {
  // Уже существующие блоки (идентификаторы сохраняем): Открытость (op1-op8), Добросовестность (co1-co8)
  const openness = [
    { id: 'op1', title: 'Мне интересно пробовать новые методы работы, даже если они непривычны.' },
    { id: 'op2', title: 'Я предпочитаю разнообразные задачи однообразным.' },
    { id: 'op3', title: 'Мне нравится изучать смежные области или расширять знания вне текущей роли.' },
    { id: 'op4', title: 'Я быстро нахожу нестандартные решения проблем.' },
    { id: 'op5', title: 'Я чувствую скуку, когда всё предсказуемо и без новых идей.' },
    { id: 'op6', title: 'Мне комфортнее следовать проверенной методике.' },
    { id: 'op7', title: 'Я стараюсь видеть возможности для улучшения в любых рабочих процессах.' },
    { id: 'op8', title: 'Люди часто называют мои подходы креативными.' }
  ].map(q => ({ id: q.id, type: 'rating' as const, title: q.title, required: true, section: 'openness', scale }));

  const conscientiousness = [
    { id: 'co1', title: 'Я всегда стараюсь доводить задачи до конца, даже если приходится задерживаться.' },
    { id: 'co2', title: 'Мне важно, чтобы работа была выполнена точно и в срок.' },
    { id: 'co3', title: 'Я редко забываю о своих обязательствах.' },
    { id: 'co4', title: 'Я склонен составлять детальные планы.' },
    { id: 'co5', title: 'Импровизация лучше, чем следование плану.' },
    { id: 'co6', title: 'Коллеги могут на меня положиться в важных вопросах.' },
    { id: 'co7', title: 'Мне нравится ставить приоритеты и действовать по чек‑листу.' },
    { id: 'co8', title: 'Я предпочитаю порядок и структуру даже в мелочах.' }
  ].map(q => ({ id: q.id, type: 'rating' as const, title: q.title, required: true, section: 'conscientiousness', scale }));

  // Новые блоки: Экстраверсия (ex1-ex8)
  const extraversion = [
    { id: 'ex1', title: 'Я чувствую прилив энергии при общении с новыми людьми.' },
    { id: 'ex2', title: 'Мне комфортно выступать или выражать своё мнение на собраниях.' },
    { id: 'ex3', title: 'Я часто инициирую взаимодействие в команде.' },
    { id: 'ex4', title: 'Я чувствую себя истощённым после длительного общения.' },
    { id: 'ex5', title: 'Я люблю быть в центре событий.' },
    { id: 'ex6', title: 'Мне важно ощущение динамики и быстрого темпа работы.' },
    { id: 'ex7', title: 'Я легко завожу контакты в новой среде.' },
    { id: 'ex8', title: 'Иногда мне трудно сосредоточиться в тишине и одиночестве.' }
  ].map(q => ({ id: q.id, type: 'rating' as const, title: q.title, required: true, section: 'extraversion', scale }));

  // Доброжелательность (ag1-ag8)
  const agreeableness = [
    { id: 'ag1', title: 'Я легко нахожу общий язык даже с трудными коллегами.' },
    { id: 'ag2', title: 'Я стараюсь помочь, когда вижу, что у кого‑то проблемы по работе.' },
    { id: 'ag3', title: 'Мне важно, чтобы в команде сохранялась гармония.' },
    { id: 'ag4', title: 'Иногда я прямо выражаю несогласие, даже если это может задеть другого.' },
    { id: 'ag5', title: 'Я стараюсь смотреть на вещи с точки зрения другого человека.' },
    { id: 'ag6', title: 'Я чувствую удовольствие, когда у коллег всё получается.' },
    { id: 'ag7', title: 'Мне несложно попросить прощения, если я был неправ.' },
    { id: 'ag8', title: 'Мне важно быть полезным для команды, даже сверх формальных обязанностей.' }
  ].map(q => ({ id: q.id, type: 'rating' as const, title: q.title, required: true, section: 'agreeableness', scale }));

  // Нейротизм / Эмоциональная устойчивость (ne1-ne8)
  const neuroticism = [
    { id: 'ne1', title: 'Я часто волнуюсь из‑за мелких деталей.' },
    { id: 'ne2', title: 'Мне тяжело полностью отвлечься от работы в конце дня.' },
    { id: 'ne3', title: 'Я спокойно реагирую на критику.' },
    { id: 'ne4', title: 'Я нервничаю, когда многое зависит от меня одного.' },
    { id: 'ne5', title: 'Я сохраняю рациональное мышление в стрессе.' },
    { id: 'ne6', title: 'Когда что‑то идёт не по плану, я легко сбиваюсь с настроя.' },
    { id: 'ne7', title: 'Мне трудно скрывать раздражение, когда всё идёт медленно.' },
    { id: 'ne8', title: 'Я быстро восстанавливаю эмоциональное равновесие после неудачи.' }
  ].map(q => ({ id: q.id, type: 'rating' as const, title: q.title, required: true, section: 'neuroticism', scale }));

  const questions = [...openness, ...conscientiousness, ...extraversion, ...agreeableness, ...neuroticism];

  // выстраиваем nextQuestion по порядку
  for (let i = 0; i < questions.length - 1; i++) {
    (questions[i] as any).nextQuestion = questions[i + 1].id;
  }

  return { questions };
}

function buildSectionsMeta() {
  return [
    { id: 'openness', title: 'Открытость к опыту', description: 'Любознательность, креативность и интерес к новому' },
    { id: 'conscientiousness', title: 'Добросовестность', description: 'Организованность, дисциплина, надёжность' },
    { id: 'extraversion', title: 'Экстраверсия', description: 'Социальность, энергичность, уверенность' },
    { id: 'agreeableness', title: 'Доброжелательность', description: 'Сотрудничество, эмпатия, альтруизм' },
    { id: 'neuroticism', title: 'Нейротизм (эмоциональная устойчивость)', description: 'Способность сохранять спокойствие под стрессом' }
  ];
}

async function updateBigFiveAddBlocks(): Promise<void> {
  await connectDatabase();

  // Ищем существующий опрос Big Five
  const res = await query(
    `SELECT id, metadata FROM surveys WHERE title ILIKE $1 OR ($2 = ANY(tags)) LIMIT 1`,
    ['%Большая пятёрка%', 'big-five']
  );

  const { questions } = buildAllSectionsQuestions();
  const logic = { startQuestion: 'op1', endPoints: ['ne8'] } as const;
  const sections = buildSectionsMeta();

  const surveyRepository = new SurveyRepository(pool);
  const surveyService = new SurveyService(surveyRepository);

  if (res.rows.length === 0) {
    // Если опрос не найден — создаем его сразу с полным набором секций
    const dto: CreateSurveyDto = {
      title: 'Большая пятёрка (Big Five)',
      description:
        'Оценка пяти ключевых личностных черт: Открытость, Добросовестность, Экстраверсия, Доброжелательность, Нейротизм.',
      questions,
      logic,
      settings: { allowBack: true, showProgress: true, savePartialResults: true },
      metadata: {
        category: 'personality',
        estimatedDuration: 15,
        author: 'System',
        tags: ['big-five', 'personality', 'v1.1.0'],
        version: '1.1.0',
        sections
      }
    };
    await surveyService.createSurvey(dto);
    console.log('✅ Big Five создан (полная версия на 40 вопросов)');
  } else {
    const surveyId: string = res.rows[0].id;
    const existingMeta = res.rows[0].metadata || {};

    const updateDto: UpdateSurveyDto = {
      questions,
      logic,
      metadata: {
        ...existingMeta,
        sections,
        version: '1.1.0',
        tags: Array.isArray(existingMeta.tags)
          ? Array.from(new Set([...(existingMeta.tags as string[]), 'v1.1.0']))
          : ['v1.1.0']
      },
      description: 'Оценка пяти ключевых личностных черт: Открытость, Добросовестность, Экстраверсия, Доброжелательность, Нейротизм.'
    };

    const updated = await surveyService.updateSurvey(surveyId, updateDto);
    console.log('✅ Big Five обновлён до 40 вопросов:', { id: updated.id });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateBigFiveAddBlocks()
    .then(() => closeDatabase())
    .then(() => {
      console.log('🎉 Обновление Big Five завершено');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ошибка обновления Big Five:', err);
      closeDatabase().finally(() => process.exit(1));
    });
}

export { updateBigFiveAddBlocks };


