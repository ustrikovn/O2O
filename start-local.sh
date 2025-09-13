#!/bin/bash

echo "🚀 Запуск системы O2O (локально без Docker)..."

# Проверяем, установлен ли Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js и попробуйте снова."
    exit 1
fi

# Проверяем, установлен ли npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен. Установите npm и попробуйте снова."
    exit 1
fi

echo "1️⃣ Переходим в папку backend..."
cd backend

echo "2️⃣ Устанавливаем зависимости..."
npm install

echo "3️⃣ Собираем TypeScript..."
npm run build

echo "4️⃣ Запускаем backend в режиме разработки..."
echo "⚠️  ВНИМАНИЕ: Убедитесь, что PostgreSQL запущена локально или через Docker:"
echo "   docker-compose up -d postgres"
echo ""

npm run dev
