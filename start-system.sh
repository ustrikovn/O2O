#!/bin/bash

echo "🚀 Запуск системы O2O..."

# Проверяем, установлен ли Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

# Проверяем, установлен ли docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose не установлен. Установите docker-compose и попробуйте снова."
    exit 1
fi

echo "1️⃣ Останавливаем существующие контейнеры..."
docker-compose down

echo "2️⃣ Запускаем PostgreSQL..."
docker-compose up -d postgres

echo "3️⃣ Ждем, пока база данных запустится..."
sleep 10

echo "4️⃣ Проверяем состояние базы данных..."
docker-compose ps postgres

echo "5️⃣ Переходим в папку backend и устанавливаем зависимости..."
cd backend
npm install

echo "6️⃣ Собираем TypeScript..."
npm run build

echo "7️⃣ Запускаем миграции базы данных..."
npm run db:migrate

echo "8️⃣ Запускаем backend сервер..."
npm run dev &

echo "✅ Система запущена!"
echo "📊 API доступно по адресу: http://localhost:3001"
echo "🔧 Health check: http://localhost:3001/api/health"
echo ""
echo "Для остановки используйте Ctrl+C"

wait
