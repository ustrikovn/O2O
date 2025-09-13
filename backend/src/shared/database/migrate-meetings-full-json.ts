/**
 * Скрипт для применения полностью JSON миграции схемы встреч
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, query } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runFullJsonMeetingsMigration(): Promise<void> {
  try {
    console.log('🔄 Начинаем применение ПОЛНОСТЬЮ JSON миграции схемы встреч...');
    
    // Подключаемся к базе данных
    await connectDatabase();
    console.log('✅ Подключение к базе данных установлено');
    
    // Читаем файл миграции
    const migrationPath = path.join(__dirname, 'migrations', '004_meetings_full_json.sql');
    const migrationSql = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('📄 Файл полностью JSON миграции загружен');
    
    // Выполняем миграцию
    await query(migrationSql);
    console.log('✅ Полностью JSON миграция схемы встреч успешно применена');
    
    // Проверяем, что таблица создана
    const checkTableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'meetings'
      ORDER BY table_name;
    `;
    
    const result = await query(checkTableQuery);
    console.log('📊 Созданная таблица:', result.rows.map(row => row.table_name));
    
    // Проверяем структуру таблицы
    const checkColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'meetings'
      ORDER BY ordinal_position;
    `;
    
    const columnsResult = await query(checkColumnsQuery);
    console.log('🏗️ Структура таблицы meetings:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Проверяем enum типы
    const checkEnumsQuery = `
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('meeting_status')
      ORDER BY typname;
    `;
    
    const enumResult = await query(checkEnumsQuery);
    console.log('🏷️ Созданные enum типы:', enumResult.rows.map(row => row.typname));
    
    console.log('🎉 Полностью JSON миграция завершена успешно!');
    console.log('');
    console.log('📋 Финальная структура данных:');
    console.log('   • Одна таблица: meetings');
    console.log('   • Все данные в JSON поле: content');
    console.log('   • Заметки: content.notes (строка)');
    console.log('   • Договоренности: content.agreements (массив)');
    console.log('   • Максимум 20 договоренностей на встречу');
    console.log('   • Убраны лишние поля и типы');
    
    // Пример вставки тестовых данных
    console.log('');
    console.log('💡 Пример JSON структуры:');
    console.log(`{
  "notes": "Заметки о встрече...", 
  "agreements": [
    {
      "id": "agreement-1",
      "title": "Задача для сотрудника",
      "type": "employee_task"
    }
  ]
}`);
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении полностью JSON миграции:', error);
    throw error;
  }
}

// Запуск миграции, если файл вызывается напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullJsonMeetingsMigration()
    .then(() => {
      console.log('✅ Скрипт полностью JSON миграции завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка выполнения скрипта:', error);
      process.exit(1);
    });
}

export { runFullJsonMeetingsMigration };
