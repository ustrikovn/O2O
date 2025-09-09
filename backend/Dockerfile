# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads/photos

# Устанавливаем права доступа
RUN chown -R node:node /app

# Переключаемся на пользователя node
USER node

# Открываем порт
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"]
