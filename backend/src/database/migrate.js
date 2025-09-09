import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, connectDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Выполнение миграций базы данных
 */
async function runMigrations() {
  try {
    console.log('🚀 Начало миграции базы данных...');
    
    // Подключение к базе данных
    await connectDatabase();
    
    // Чтение SQL схемы
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Выполнение миграции
    console.log('📝 Применение схемы базы данных...');
    await pool.query(schemaSql);
    
    console.log('✅ Миграция завершена успешно!');
    
    // Проверка созданных таблиц
    const result = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📊 Созданные таблицы:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name} (${row.table_type})`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Запуск миграции, если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('🎉 Миграция базы данных завершена!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Ошибка миграции:', error);
      process.exit(1);
    });
}

export { runMigrations };
