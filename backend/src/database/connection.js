import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Настройки подключения к PostgreSQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'o2o_db',
  user: process.env.DB_USER || 'o2o_user',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // максимальное количество подключений в пуле
  idleTimeoutMillis: 30000, // время ожидания перед закрытием неактивного подключения
  connectionTimeoutMillis: 2000, // время ожидания подключения
};

// Создание пула подключений
export const pool = new Pool(dbConfig);

// Обработка ошибок подключения
pool.on('error', (err) => {
  console.error('Неожиданная ошибка базы данных:', err);
  process.exit(-1);
});

/**
 * Подключение к базе данных и проверка соединения
 */
export async function connectDatabase() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('🗄️  База данных подключена:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    throw error;
  }
}

/**
 * Выполнение SQL запроса
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('🔍 Выполнен запрос:', { text, duration: `${duration}ms`, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('❌ Ошибка выполнения запроса:', { text, error: error.message });
    throw error;
  }
}

/**
 * Получение клиента для транзакций
 */
export async function getClient() {
  return await pool.connect();
}

/**
 * Закрытие пула подключений
 */
export async function closeDatabase() {
  await pool.end();
  console.log('📪 Пул подключений закрыт');
}
