/**
 * Скрипт миграции для таблицы характеристик сотрудников
 */

import { query, connectDatabase, closeDatabase } from '@/shared/database/connection.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Подключение к базе данных...');
    await connectDatabase();
    
    console.log('📖 Чтение файла миграции...');
    const migrationPath = path.join(
      __dirname,
      '../shared/database/migrations/006_employee_characteristics.sql'
    );
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('🚀 Применение миграции...');
    await query(migrationSQL);
    
    console.log('✅ Миграция успешно применена!');
    console.log('📊 Таблица employee_characteristics создана');
    
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    process.exit(1);
  }
}

runMigration();

