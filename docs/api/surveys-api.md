# API опросов (Surveys)

## Обзор

API для управления опросами (DISC, Big Five и др.) и их результатами.

**Base URL:** `/api/surveys`

---

## Управление опросами

### Получение списка опросов

```
GET /api/surveys
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `category` | string | Категория (profiling, feedback) |

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "DISC Assessment",
      "description": "Оценка поведенческого профиля",
      "category": "profiling",
      "is_active": true
    }
  ],
  "count": 2
}
```

---

### Получение опроса по ID

```
GET /api/surveys/:id
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "DISC Assessment",
    "description": "...",
    "category": "profiling",
    "questions": [
      {
        "id": "q1",
        "type": "single-choice",
        "title": "Что больше всего мотивирует вас?",
        "required": true,
        "options": [
          { "value": "recognition", "label": "Признание" },
          { "value": "growth", "label": "Развитие" }
        ]
      }
    ],
    "settings": {
      "allowBack": true,
      "showProgress": true
    }
  }
}
```

---

### Создание опроса

```
POST /api/surveys
```

**Тело запроса:**
```json
{
  "title": "Название опроса",
  "description": "Описание",
  "category": "profiling",
  "questions": [...],
  "settings": {
    "allowBack": true,
    "showProgress": true,
    "randomizeOptions": false
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Опрос успешно создан",
  "data": { ... }
}
```

---

### Обновление опроса

```
PUT /api/surveys/:id
```

**Тело запроса:**
```json
{
  "title": "Новое название",
  "description": "Новое описание"
}
```

---

### Удаление опроса

```
DELETE /api/surveys/:id
```

---

### Деактивация опроса

```
POST /api/surveys/:id/deactivate
```

Скрывает опрос из списка активных.

---

### Статистика опроса

```
GET /api/surveys/:id/statistics
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "total_started": 50,
    "total_completed": 45,
    "completion_rate": 0.9,
    "average_duration_minutes": 12
  }
}
```

---

### Результаты опроса

```
GET /api/surveys/:id/results
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `status` | string | in_progress, completed, abandoned |
| `limit` | number | Количество (по умолчанию 50) |
| `offset` | number | Смещение |

**Ответ:**
```json
{
  "success": true,
  "data": [...],
  "total": 45,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Прохождение опроса

### Начать опрос

```
POST /api/surveys/start
```

**Тело запроса:**
```json
{
  "surveyId": "uuid",
  "employeeId": "uuid",
  "meetingId": "uuid"  // опционально
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Опрос начат",
  "data": {
    "resultId": "uuid",
    "question": {
      "id": "q1",
      "type": "single-choice",
      "title": "Первый вопрос...",
      "options": [...]
    },
    "progress": {
      "current": 1,
      "total": 10
    }
  }
}
```

---

### Отправить ответ

```
POST /api/surveys/answer
```

**Тело запроса:**
```json
{
  "resultId": "uuid",
  "questionId": "q1",
  "answer": "recognition"
}
```

**Ответ (следующий вопрос):**
```json
{
  "success": true,
  "message": "Ответ принят",
  "data": {
    "nextQuestion": {
      "id": "q2",
      "type": "rating",
      "title": "Оцените важность...",
      "scale": { "min": 1, "max": 10 }
    },
    "progress": {
      "current": 2,
      "total": 10
    },
    "isCompleted": false
  }
}
```

**Ответ (опрос завершён):**
```json
{
  "success": true,
  "message": "Опрос завершен",
  "data": {
    "isCompleted": true,
    "resultId": "uuid"
  }
}
```

---

### Завершить опрос

```
POST /api/surveys/complete
```

Принудительное завершение (например, при таймауте).

**Тело запроса:**
```json
{
  "resultId": "uuid"
}
```

**Важно:** После завершения запускается автообновление характеристики сотрудника.

---

### Восстановить опрос

```
POST /api/surveys/results/:resultId/resume
```

Продолжить незавершённый опрос с последнего вопроса.

---

## Результаты

### Получить результат

```
GET /api/surveys/results/:resultId
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "surveyId": "uuid",
    "employeeId": "uuid",
    "status": "completed",
    "answers": {
      "q1": "recognition",
      "q2": 8,
      "q3": ["technical", "leadership"]
    },
    "metadata": {
      "disc": {
        "scores": { "D": 75, "I": 60, "S": 45, "C": 55 },
        "primary_type": "D",
        "interpretation": "..."
      }
    },
    "startedAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:12:00Z"
  }
}
```

---

### DISC-интерпретация

```
GET /api/surveys/results/:resultId/disc
```

Возвращает только DISC-данные из metadata.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "scores": { "D": 75, "I": 60, "S": 45, "C": 55 },
    "primary_type": "D",
    "secondary_type": "I",
    "interpretation": "Иван — прямой и целеустремлённый..."
  }
}
```

---

### Результаты сотрудника

```
GET /api/surveys/employees/:employeeId/results
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `surveyId` | UUID | Фильтр по опросу |

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "surveyId": "uuid",
      "surveyTitle": "DISC Assessment",
      "status": "completed",
      "completedAt": "2024-01-15T10:12:00Z"
    }
  ],
  "count": 2
}
```

---

### Результаты встречи

```
GET /api/surveys/meetings/:meetingId/results
```

Опросы, проведённые во время конкретной встречи.

---

## Служебные endpoints

### Очистка заброшенных

```
POST /api/surveys/maintenance/cleanup-abandoned
```

**Тело запроса:**
```json
{
  "hours": 24
}
```

Помечает как `abandoned` опросы, незавершённые более N часов.

---

## Типы вопросов

| Тип | Описание | Формат ответа |
|-----|----------|---------------|
| `single-choice` | Один вариант | string |
| `multiple-choice` | Несколько вариантов | string[] |
| `rating` | Шкала | number |
| `text` | Короткий текст | string |
| `textarea` | Длинный текст | string |

---

## Статусы результатов

| Статус | Описание |
|--------|----------|
| `in_progress` | Опрос в процессе |
| `completed` | Успешно завершён |
| `abandoned` | Заброшен |

---

## Связанная документация

- [Бизнес-описание опросов](../features/surveys.md)
- [API характеристик](characteristics-api.md)
- [Схема базы данных](../DATABASE.md)
