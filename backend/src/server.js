import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDatabase } from './database/connection.js';
import employeeRoutes from './routes/employees.js';

// Настройка для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Настройка rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: process.env.API_RATE_LIMIT || 100, // максимум запросов
  message: { error: 'Слишком много запросов, попробуйте позже' }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:5176', 'http://127.0.0.1:5176', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы для загруженных фотографий
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Маршруты API
app.use('/api/employees', employeeRoutes);

// Базовый маршрут для проверки здоровья сервиса
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Обработка 404 ошибок
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Маршрут не найден', 
    path: req.originalUrl 
  });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Запуск сервера
async function startServer() {
  try {
    // Подключение к базе данных
    await connectDatabase();
    console.log('✅ Подключение к базе данных установлено');
    
    // Запуск HTTP сервера
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Получен SIGTERM, завершение работы...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Получен SIGINT, завершение работы...');
  process.exit(0);
});

startServer();
