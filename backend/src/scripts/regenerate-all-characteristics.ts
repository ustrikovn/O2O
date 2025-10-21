/**
 * Скрипт для регенерации всех характеристик сотрудников
 */

import { CharacteristicEntity } from '@/entities/characteristic/index.js';
import { CharacteristicGenerationService } from '@/shared/lib/characteristic-generation.js';
import { query } from '@/shared/database/connection.js';

const generationService = new CharacteristicGenerationService();

async function regenerateAllCharacteristics() {
  console.log('🔄 Начинаем регенерацию всех характеристик...\n');

  try {
    // Получаем всех сотрудников
    const employeesResult = await query('SELECT id, first_name, last_name FROM employees ORDER BY last_name, first_name');
    const employees = employeesResult.rows;

    console.log(`📊 Найдено сотрудников: ${employees.length}\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const employee of employees) {
      const fullName = `${employee.first_name} ${employee.last_name}`;
      
      try {
        console.log(`⏳ Обрабатываем: ${fullName}...`);
        
        // Получаем существующую характеристику
        const existing = await CharacteristicEntity.findByEmployeeId(employee.id);
        
        // Проверяем, есть ли данные для генерации
        const { context, dataRichness } = await generationService.computeContextFingerprint(employee.id);
        
        if (dataRichness.score === 0) {
          console.log(`  ⚠️  Пропускаем ${fullName} - недостаточно данных`);
          skipped++;
          continue;
        }
        
        // Генерируем новую характеристику
        const result = await generationService.generateCharacteristic(
          employee.id,
          existing?.content
        );
        
        // Сохраняем
        await CharacteristicEntity.upsert(employee.id, result);
        
        console.log(`  ✅ ${fullName} - обновлено (наполненность: ${dataRichness.score}/100)`);
        updated++;
        
        // Небольшая пауза между запросами к LLM
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`  ❌ Ошибка для ${fullName}:`, error instanceof Error ? error.message : error);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 Итоги:');
    console.log(`  ✅ Обновлено: ${updated}`);
    console.log(`  ⚠️  Пропущено (нет данных): ${skipped}`);
    console.log(`  ❌ Ошибок: ${errors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Запуск
regenerateAllCharacteristics();


