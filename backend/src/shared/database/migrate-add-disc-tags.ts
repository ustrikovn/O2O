/**
 * Миграция данных: добавление DISC-тегов к вопросам q9, q10, q11
 * - q9  -> disc:leadership
 * - q10 -> disc:obstacle
 * - q11 -> disc:difficult
 */

import { connectDatabase, query, closeDatabase } from '@/shared/database/connection.js';

type Question = {
  id: string;
  type: string;
  title: string;
  tags?: string[];
  [key: string]: any;
};

async function addDiscTags(): Promise<void> {
  await connectDatabase();

  const res = await query('SELECT id, questions FROM surveys');
  let surveysScanned = 0;
  let surveysUpdated = 0;
  const updates: Array<{ id: string; changed: boolean }> = [];

  for (const row of res.rows) {
    surveysScanned++;
    const surveyId: string = row.id;
    const questions: Question[] = Array.isArray(row.questions) ? row.questions : [];

    let changed = false;
    const updatedQuestions = questions.map((q) => {
      if (!q || !q.id) return q;

      const ensureTag = (tag: string): void => {
        if (!Array.isArray(q.tags)) q.tags = [];
        if (!q.tags.includes(tag)) q.tags.push(tag);
      };

      if (q.id === 'q9') {
        ensureTag('disc:leadership');
        changed = true;
      } else if (q.id === 'q10') {
        ensureTag('disc:obstacle');
        changed = true;
      } else if (q.id === 'q11') {
        ensureTag('disc:difficult');
        changed = true;
      }

      return q;
    });

    updates.push({ id: surveyId, changed });

    if (changed) {
      await query(
        `UPDATE surveys SET questions = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [surveyId, JSON.stringify(updatedQuestions)]
      );
      surveysUpdated++;
    }
  }

  console.log('📋 Обработка завершена');
  console.log('  Просмотрено опросов:', surveysScanned);
  console.log('  Обновлено опросов:', surveysUpdated);
  console.table(updates);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  addDiscTags()
    .then(() => closeDatabase())
    .then(() => {
      console.log('✅ Миграция DISC-тегов завершена');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ошибка миграции DISC-тегов:', err);
      closeDatabase().finally(() => process.exit(1));
    });
}

export { addDiscTags };


