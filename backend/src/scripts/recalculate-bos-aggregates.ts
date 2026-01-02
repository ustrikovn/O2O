/**
 * Скрипт пересчёта интегральных BOS-показателей
 * для всех сотрудников с существующими BOS-наблюдениями.
 * 
 * Запуск: npx tsx src/scripts/recalculate-bos-aggregates.ts
 */

import { query } from '../shared/database/connection.js';
import { BOSAggregateService } from '../features/meetings/lib/bos-aggregate-service.js';

async function recalculateAllBOSAggregates() {
  console.log('🔄 Начинаем пересчёт BOS-агрегатов...\n');

  try {
    // 1. Получаем список уникальных сотрудников с completed BOS-наблюдениями
    const sql = `
      SELECT DISTINCT employee_id 
      FROM meeting_bos_observations 
      WHERE status = 'completed'
      ORDER BY employee_id;
    `;
    
    const result = await query(sql, []);
    const employeeIds: string[] = result.rows.map((row: any) => row.employee_id);

    if (employeeIds.length === 0) {
      console.log('⚠️  Нет сотрудников с завершёнными BOS-наблюдениями.');
      return;
    }

    console.log(`📊 Найдено ${employeeIds.length} сотрудников с BOS-данными.\n`);

    // 2. Пересчитываем агрегат для каждого
    let successCount = 0;
    let errorCount = 0;

    for (const employeeId of employeeIds) {
      try {
        await BOSAggregateService.updateAggregate(employeeId);
        successCount++;
        console.log(`✅ ${employeeId}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ ${employeeId}: ${error}`);
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`✅ Успешно: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ Ошибки: ${errorCount}`);
    }
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }

  // Закрываем соединение
  process.exit(0);
}

// Запуск
recalculateAllBOSAggregates();

