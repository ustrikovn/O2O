# Настройка системы встреч

## Установка и развертывание

### 1. Применение миграции базы данных

Перед использованием новой функциональности необходимо применить миграцию для создания таблиц встреч:

```bash
cd backend
npm run db:migrate:meetings
```

Эта команда создаст следующие таблицы:
- `meetings` - основная таблица встреч
- `meeting_notes` - таблица заметок
- `meeting_agreements` - таблица договоренностей

### 2. Проверка миграции

После применения миграции убедитесь, что таблицы созданы:

```sql
-- Подключитесь к PostgreSQL и выполните:
\dt

-- Должны появиться новые таблицы:
-- meetings
-- meeting_notes  
-- meeting_agreements
```

### 3. Запуск backend сервера

```bash
cd backend
npm run dev
```

Сервер будет доступен на `http://localhost:3001`

## Тестирование API

### 1. Проверка здоровья сервиса

```bash
curl http://localhost:3001/api/health
```

### 2. Создание встречи

Сначала получите ID сотрудника:
```bash
curl http://localhost:3001/api/employees
```

Затем создайте встречу:
```bash
curl -X POST http://localhost:3001/api/meetings \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "YOUR_EMPLOYEE_ID",
    "title": "Еженедельная встреча 1:1",
    "scheduledAt": "2024-01-15T10:00:00Z"
  }'
```

### 3. Начало встречи

```bash
curl -X POST http://localhost:3001/api/meetings/MEETING_ID/start \
  -H "Content-Type: application/json"
```

### 4. Добавление заметки

```bash
curl -X POST http://localhost:3001/api/meetings/MEETING_ID/notes \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Сотрудник поделился идеями по улучшению процессов",
    "noteType": "feedback",
    "tags": ["improvement", "processes"]
  }'
```

### 5. Добавление договоренности

```bash
curl -X POST http://localhost:3001/api/meetings/MEETING_ID/agreements \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Подготовить план оптимизации процессов",
    "description": "Детальный план с конкретными шагами",
    "agreementType": "employee_task",
    "priority": 2,
    "dueDate": "2024-01-22"
  }'
```

### 6. Завершение встречи

```bash
curl -X POST http://localhost:3001/api/meetings/MEETING_ID/end \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Продуктивная встреча с обсуждением улучшений",
    "satisfactionRating": 9
  }'
```

### 7. Получение детальной информации о встрече

```bash
curl http://localhost:3001/api/meetings/MEETING_ID
```

## Структура данных

### Схема базы данных

#### Таблица meetings
- `id` - UUID встречи
- `employee_id` - связь с сотрудником
- `status` - статус встречи (scheduled, active, completed, cancelled)
- `started_at` - время начала
- `ended_at` - время завершения
- `scheduled_at` - запланированное время
- `title` - название встречи
- `summary` - резюме встречи
- `satisfaction_rating` - оценка от 1 до 10

#### Таблица meeting_notes
- `id` - UUID заметки
- `meeting_id` - связь с встречей
- `content` - содержание заметки
- `note_type` - тип заметки (general, feedback, observation, concern)
- `tags` - массив тегов для категоризации

#### Таблица meeting_agreements
- `id` - UUID договоренности
- `meeting_id` - связь с встречей
- `title` - название договоренности
- `description` - описание
- `agreement_type` - тип (employee_task, manager_task, mutual_agreement)
- `status` - статус (pending, in_progress, completed, cancelled)
- `priority` - приоритет от 1 до 5
- `due_date` - срок выполнения
- `parent_agreement_id` - связь с родительской договоренностью

## Архитектурные особенности

### Feature-Sliced Design

Код организован согласно принципам feature-sliced design:

```
backend/src/
├── entities/
│   └── meeting/           # Бизнес-сущность встречи
│       ├── index.ts
│       └── model/
│           └── meeting.ts
├── features/
│   └── meetings/          # Фича управления встречами
│       ├── index.ts
│       ├── api/
│       │   └── routes.ts
│       └── lib/
│           └── validation.ts
└── shared/
    ├── types/
    │   └── meeting.ts     # Типы для встреч
    └── database/
        └── migrations/
            └── 002_create_meetings_schema.sql
```

### Принципы проектирования

1. **Микросервисность** - каждая фича независима
2. **Типизация** - полная типизация на TypeScript
3. **Валидация** - строгая валидация входных данных
4. **Консистентность** - единообразный стиль API
5. **Масштабируемость** - легко добавлять новые фичи

## Интеграция с фронтендом

Для интеграции с существующим фронтендом используйте endpoints из [meetings-api.md](./meetings-api.md).

Основные сценарии:
1. **Кнопка "Начать встречу"** → `POST /api/meetings` + `POST /api/meetings/:id/start`
2. **Кнопка "Завершить встречу"** → `POST /api/meetings/:id/end`
3. **Добавление заметок** → `POST /api/meetings/:id/notes`
4. **Создание договоренностей** → `POST /api/meetings/:id/agreements`

## Мониторинг и статистика

Система предоставляет endpoints для получения статистики:

- `/api/meetings/stats` - общая статистика встреч
- `/api/meetings/agreements/stats` - статистика договоренностей  
- `/api/meetings/employees/:id/stats` - статистика по сотруднику

## Следующие шаги

1. **Интеграция с ИИ** - добавление LLM для анализа заметок и генерации рекомендаций
2. **Уведомления** - система напоминаний о договоренностях
3. **Аналитика** - дашборды для визуализации данных
4. **Экспорт** - возможность экспорта отчетов

## Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Убедитесь, что миграция применена корректно
3. Проверьте подключение к базе данных
4. Используйте `npm run typecheck` для проверки типов
