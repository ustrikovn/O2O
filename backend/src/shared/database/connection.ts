/**
 * Подключение к базе данных PostgreSQL
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { getDatabaseConfig } from '@/shared/config/database.js';

dotenv.config();

const { Pool } = pg;

// Создание пула подключений
export const pool = new Pool(getDatabaseConfig());

// Обработка ошибок подключения
pool.on('error', (err: Error) => {
  console.error('Неожиданная ошибка базы данных:', err);
  process.exit(-1);
});

/**
 * Подключение к базе данных и проверка соединения
 */
export async function connectDatabase(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('🗄️  База данных подключена:', result.rows[0]?.now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', (error as Error).message);
    throw error;
  }
}

/**
 * Выполнение SQL запроса
 */
export async function query(text: string, params?: any[]): Promise<pg.QueryResult> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('🔍 Выполнен запрос:', { 
      text, 
      duration: `${duration}ms`, 
      rows: result.rowCount 
    });
    return result;
  } catch (error) {
    console.error('❌ Ошибка выполнения запроса:', { 
      text, 
      error: (error as Error).message 
    });
    throw error;
  }
}

/**
 * Получение клиента для транзакций
 */
export async function getClient(): Promise<pg.PoolClient> {
  return await pool.connect();
}

/**
 * Закрытие пула подключений
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
  console.log('📪 Пул подключений закрыт');
}
