# Инструкция по запуску базы данных O2O

## Требования

- Docker и Docker Compose
- Node.js 18+ (для разработки backend)

## Быстрый запуск базы данных

### 1. Запуск PostgreSQL в Docker

```bash
# Запуск только базы данных
docker-compose up postgres -d

# Проверка статуса
docker-compose ps
```

### 2. Установка зависимостей backend

```bash
cd backend
npm install
```

### 3. Применение миграций

```bash
# Из папки backend
npm run db:migrate
```

### 4. Запуск backend сервера

```bash
# Режим разработки с автоперезагрузкой
npm run dev

# Или обычный запуск
npm start
```

## Проверка работы

1. **Health check сервера**: http://localhost:3001/api/health
2. **Статистика сотрудников**: http://localhost:3001/api/employees/stats
3. **База данных доступна на**: localhost:5432

## Данные для подключения к PostgreSQL

- **Host**: localhost
- **Port**: 5432
- **Database**: o2o_db
- **User**: o2o_user
- **Password**: o2o_secure_password_2024

## API Endpoints

### Сотрудники

- `GET /api/employees` - Получить всех сотрудников
- `POST /api/employees` - Создать сотрудника
- `GET /api/employees/:id` - Получить сотрудника по ID
- `PUT /api/employees/:id` - Обновить сотрудника
- `DELETE /api/employees/:id` - Деактивировать сотрудника
- `GET /api/employees/team/:team` - Получить сотрудников команды
- `GET /api/employees/stats` - Статистика
- `GET /api/employees/teams` - Список команд

### Пример создания сотрудника

```bash
curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Иванов",
    "email": "ivan.ivanov@company.com",
    "position": "Системный аналитик",
    "team": "Разработка"
  }'
```

## Остановка сервисов

```bash
# Остановка всех сервисов
docker-compose down

# Остановка с удалением данных
docker-compose down -v
```

## Структура базы данных

### Таблица employees

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Уникальный идентификатор |
| first_name | VARCHAR(100) | Имя сотрудника |
| last_name | VARCHAR(100) | Фамилия сотрудника |
| email | VARCHAR(255) | Email (уникальный) |
| position | VARCHAR(200) | Должность |
| team | VARCHAR(200) | Команда |
| photo_url | VARCHAR(500) | URL фотографии |
| is_active | BOOLEAN | Активность сотрудника |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

## Troubleshooting

### База данных не запускается

```bash
# Проверка логов
docker-compose logs postgres

# Пересоздание контейнера
docker-compose down postgres
docker-compose up postgres -d
```

### Ошибки миграции

```bash
# Подключение к базе данных
docker exec -it o2o_postgres psql -U o2o_user -d o2o_db

# Проверка таблиц
\dt

# Выход
\q
```
