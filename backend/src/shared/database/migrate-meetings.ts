/**
 * Скрипт для применения миграции схемы встреч
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, query } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMeetingsMigration(): Promise<void> {
  try {
    console.log('🔄 Начинаем миграцию схемы встреч...');
    
    // Подключаемся к базе данных
    await connectDatabase();
    console.log('✅ Подключение к базе данных установлено');
    
    // Читаем файл миграции
    const migrationPath = path.join(__dirname, 'migrations', '002_create_meetings_schema.sql');
    const migrationSql = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('📄 Файл миграции загружен');
    
    // Выполняем миграцию
    await query(migrationSql);
    console.log('✅ Миграция схемы встреч успешно применена');
    
    // Проверяем, что таблицы созданы
    const checkTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('meetings', 'meeting_notes', 'meeting_agreements')
      ORDER BY table_name;
    `;
    
    const result = await query(checkTablesQuery);
    console.log('📊 Созданные таблицы:', result.rows.map(row => row.table_name));
    
    // Проверяем enum типы
    const checkEnumsQuery = `
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('meeting_status', 'agreement_status', 'agreement_type')
      ORDER BY typname;
    `;
    
    const enumResult = await query(checkEnumsQuery);
    console.log('🏷️ Созданные enum типы:', enumResult.rows.map(row => row.typname));
    
    console.log('🎉 Миграция завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    throw error;
  }
}

// Запуск миграции, если файл вызывается напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  runMeetingsMigration()
    .then(() => {
      console.log('✅ Скрипт миграции завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка выполнения скрипта:', error);
      process.exit(1);
    });
}

export { runMeetingsMigration };
