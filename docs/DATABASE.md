# Схема базы данных O2O

## Обзор

База данных PostgreSQL содержит 7 основных таблиц для хранения данных о сотрудниках, встречах, опросах и AI-анализе.

---

## ER-диаграмма

```mermaid
erDiagram
    employees ||--o{ meetings : "has"
    employees ||--o{ agreements : "assigned_to"
    employees ||--o{ survey_results : "takes"
    employees ||--|| employee_characteristics : "has"
    
    meetings ||--o{ agreements : "contains"
    meetings ||--|| meeting_bos_observations : "analyzed_by"
    meetings ||--o{ survey_results : "conducted_during"
    
    surveys ||--o{ survey_results : "produces"

    employees {
        uuid id PK
        varchar first_name
        varchar last_name
        varchar email UK
        varchar position
        varchar team
        varchar photo_url
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    meetings {
        uuid id PK
        uuid employee_id FK
        meeting_status status
        timestamp started_at
        timestamp ended_at
        jsonb content
        timestamp created_at
        timestamp updated_at
    }

    agreements {
        uuid id PK
        uuid meeting_id FK
        uuid employee_id FK
        varchar title
        text description
        varchar responsible_type
        agreement_status status
        integer priority
        date due_date
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }

    surveys {
        uuid id PK
        varchar title
        text description
        varchar category
        jsonb questions
        jsonb settings
        boolean is_active
        timestamp created_at
    }

    survey_results {
        uuid id PK
        uuid survey_id FK
        uuid employee_id FK
        uuid meeting_id FK
        result_status status
        jsonb answers
        jsonb metadata
        timestamp started_at
        timestamp completed_at
    }

    employee_characteristics {
        uuid id PK
        uuid employee_id FK UK
        text content
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    meeting_bos_observations {
        uuid id PK
        uuid meeting_id FK UK
        uuid employee_id FK
        bos_status status
        text error_message
        jsonb scores
        jsonb metadata
        timestamp created_at
        timestamp completed_at
    }
```

---

## Таблицы

### 1. employees

Сотрудники компании.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `first_name` | VARCHAR(100) | Имя |
| `last_name` | VARCHAR(100) | Фамилия |
| `email` | VARCHAR(255) | Email (уникальный) |
| `position` | VARCHAR(200) | Должность |
| `team` | VARCHAR(200) | Команда/отдел |
| `photo_url` | VARCHAR(500) | URL фотографии |
| `is_active` | BOOLEAN | Активен ли сотрудник |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Индексы:**
- `email` — уникальный
- `team` — для фильтрации по командам
- `is_active` — для фильтрации активных

---

### 2. meetings

One-to-one встречи с сотрудниками.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `employee_id` | UUID | FK → employees.id |
| `status` | ENUM | scheduled, active, completed, cancelled |
| `started_at` | TIMESTAMP | Время начала |
| `ended_at` | TIMESTAMP | Время завершения |
| `content` | JSONB | Заметки и договорённости |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Структура `content` (JSONB):**

```json
{
  "notes": "Текст заметок руководителя...",
  "agreements": [
    {
      "id": "uuid",
      "title": "Название задачи",
      "description": "Описание",
      "type": "employee_task | manager_task",
      "created_at": "ISO timestamp"
    }
  ]
}
```

**Индексы:**
- `employee_id` — для истории встреч сотрудника
- `status` — для фильтрации
- `created_at` — для сортировки

---

### 3. agreements

Договорённости (задачи) из встреч.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `meeting_id` | UUID | FK → meetings.id |
| `employee_id` | UUID | FK → employees.id |
| `title` | VARCHAR(500) | Название |
| `description` | TEXT | Описание |
| `responsible_type` | ENUM | employee_task, manager_task |
| `status` | ENUM | pending, in_progress, completed, cancelled |
| `priority` | INTEGER | 1-5 (1 = высший) |
| `due_date` | DATE | Срок выполнения |
| `completed_at` | TIMESTAMP | Дата выполнения |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Индексы:**
- `employee_id` — для списка задач сотрудника
- `meeting_id` — для задач встречи
- `status` — для фильтрации
- `due_date` — для просроченных

---

### 4. surveys

Шаблоны опросов (DISC, Big Five и др.).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `title` | VARCHAR(255) | Название опроса |
| `description` | TEXT | Описание |
| `category` | VARCHAR(100) | Категория (profiling, feedback) |
| `questions` | JSONB | Структура вопросов |
| `settings` | JSONB | Настройки (allowBack, showProgress) |
| `is_active` | BOOLEAN | Активен ли опрос |
| `created_at` | TIMESTAMP | Дата создания |

**Структура `questions` (JSONB):**

```json
[
  {
    "id": "q1",
    "type": "single-choice | multiple-choice | rating | text",
    "title": "Текст вопроса",
    "required": true,
    "options": [
      { "value": "a", "label": "Вариант A", "nextQuestion": "q2" }
    ],
    "validation": { "errorMessage": "..." }
  }
]
```

---

### 5. survey_results

Результаты прохождения опросов.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `survey_id` | UUID | FK → surveys.id |
| `employee_id` | UUID | FK → employees.id |
| `meeting_id` | UUID | FK → meetings.id (опционально) |
| `status` | ENUM | in_progress, completed, abandoned |
| `answers` | JSONB | Ответы на вопросы |
| `metadata` | JSONB | DISC/Big Five результаты, LLM-интерпретация |
| `started_at` | TIMESTAMP | Начало прохождения |
| `completed_at` | TIMESTAMP | Завершение |

**Структура `metadata` (JSONB):**

```json
{
  "disc": {
    "scores": { "D": 75, "I": 60, "S": 45, "C": 55 },
    "primary_type": "D",
    "interpretation": "LLM-текст интерпретации..."
  },
  "bigfive": {
    "scores": { "O": 70, "C": 65, "E": 55, "A": 60, "N": 40 },
    "interpretation": "..."
  }
}
```

**Индексы:**
- `employee_id` — история опросов сотрудника
- `survey_id` — результаты по опросу
- `status` — фильтрация

---

### 6. employee_characteristics

AI-сгенерированные характеристики сотрудников.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `employee_id` | UUID | FK → employees.id (уникальный) |
| `content` | TEXT | Текст характеристики |
| `metadata` | JSONB | Метаданные генерации |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Структура `metadata` (JSONB):**

```json
{
  "generation_metadata": {
    "model": "gpt-4o",
    "context_fingerprint": "hash",
    "generation_time_ms": 3500,
    "sources": {
      "disc_results": 1,
      "bigfive_results": 1,
      "meetings_count": 5
    }
  }
}
```

**Ограничения:**
- `employee_id` — уникальный (один профиль на сотрудника)

---

### 7. meeting_bos_observations

BOS-наблюдения поведения на встречах.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `meeting_id` | UUID | FK → meetings.id (уникальный) |
| `employee_id` | UUID | FK → employees.id |
| `status` | ENUM | pending, processing, completed, failed |
| `error_message` | TEXT | Сообщение об ошибке |
| `scores` | JSONB | 12 BOS-оценок |
| `metadata` | JSONB | Метаданные генерации |
| `created_at` | TIMESTAMP | Начало анализа |
| `completed_at` | TIMESTAMP | Завершение анализа |

**Структура `scores` (JSONB):**

```json
{
  "problem_articulation": { "score": 4, "evidence": "Сотрудник чётко назвал проблему с дедлайнами" },
  "interest_articulation": { "score": 3, "evidence": "Выразил интерес к новым технологиям" },
  "proactive_communication": { "score": null, "evidence": null },
  "collaborative_behavior": { "score": 5, "evidence": "Помог коллеге с задачей" },
  "feedback_receptivity": { "score": 4, "evidence": "Принял обратную связь конструктивно" },
  "task_ownership": { "score": 4, "evidence": "Взял ответственность за результат" },
  "goal_alignment": { "score": 3, "evidence": null },
  "learning_agility": { "score": 5, "evidence": "Хочет изучить TypeScript" },
  "decision_quality": { "score": null, "evidence": null },
  "emotional_intelligence": { "score": 4, "evidence": "Понимает состояние команды" },
  "commitment_to_agreements": { "score": 5, "evidence": "Выполнил все договорённости" },
  "strategic_thinking": { "score": 3, "evidence": null }
}
```

**12 BOS-поведений:**

| Ключ | Название | Описание |
|------|----------|----------|
| `problem_articulation` | Выражение проблем | Ясно называет проблемы |
| `interest_articulation` | Выражение интересов | Рассказывает о своих интересах |
| `proactive_communication` | Инициативная коммуникация | Сам инициирует обсуждения |
| `collaborative_behavior` | Сотрудничество | Работает с другими, помогает |
| `feedback_receptivity` | Восприимчивость к обратной связи | Принимает критику конструктивно |
| `task_ownership` | Ответственность за задачи | Берёт на себя ответственность |
| `goal_alignment` | Согласованность целей | Понимает связь с целями команды |
| `learning_agility` | Готовность к обучению | Хочет развиваться |
| `decision_quality` | Качество решений | Принимает взвешенные решения |
| `emotional_intelligence` | Эмоциональный интеллект | Понимает эмоции |
| `commitment_to_agreements` | Соблюдение договорённостей | Выполняет обещания |
| `strategic_thinking` | Стратегическое мышление | Думает о долгосрочной перспективе |

**Индексы:**
- `meeting_id` — уникальный
- `employee_id` — для истории BOS сотрудника
- `status` — для мониторинга
- `scores` — GIN для поиска по JSON

---

## Миграции

Файлы миграций находятся в `backend/src/shared/database/migrations/`:

| Файл | Описание |
|------|----------|
| `001_schema.sql` | Базовая схема (employees) |
| `002_create_meetings_schema.sql` | Встречи (старая структура) |
| `003_create_agreements_table.sql` | Договорённости |
| `004_meetings_full_json.sql` | Встречи с JSON content |
| `005_create_surveys_schema.sql` | Опросы и результаты |
| `006_employee_characteristics.sql` | AI-характеристики |
| `007_create_bos_observations.sql` | BOS-наблюдения |

---

## Подключение

**Docker контейнер:**
```bash
docker-compose up postgres -d
```

**Параметры подключения:**
```
Host: localhost
Port: 5432
Database: o2o_db
User: o2o_user
Password: o2o_secure_password_2024
```

**Подключение через psql:**
```bash
docker exec -it o2o_postgres psql -U o2o_user -d o2o_db
```

---

## Связанная документация

- [Архитектура системы](ARCHITECTURE.md)
- [API встреч](api/meetings-api.md)
- [BOS-анализ](features/bos-analysis.md)
