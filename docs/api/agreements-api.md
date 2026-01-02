# API договорённостей (Agreements)

## Обзор

API для управления договорённостями (задачами) из встреч. Договорённости хранятся как отдельные записи в таблице `agreements` для отслеживания статуса и истории.

**Base URL:** `/api/agreements`

---

## Endpoints

### Открытые договорённости сотрудника

```
GET /api/agreements/employees/:id/agreements/open
```

Возвращает невыполненные договорённости сотрудника.

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "meeting_id": "uuid",
      "title": "Изучить TypeScript",
      "description": "2 часа в неделю",
      "responsible_type": "employee_task",
      "status": "pending",
      "priority": 2,
      "due_date": "2024-01-22",
      "created_at": "2024-01-15T10:50:00Z"
    }
  ],
  "count": 3
}
```

---

### Договорённости встречи

```
GET /api/agreements/meetings/:id/agreements
```

Возвращает все договорённости конкретной встречи.

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Задача сотрудника",
      "responsible_type": "employee_task",
      "status": "pending"
    },
    {
      "id": "uuid",
      "title": "Задача руководителя",
      "responsible_type": "manager_task",
      "status": "completed"
    }
  ]
}
```

---

### Контекст договорённостей

```
GET /api/agreements/meetings/:id/agreements/context
```

Расширенный контекст для AI-ассистента: договорённости + история выполнения.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "current_meeting": [...],
    "previous_open": [...],
    "completion_rate": 0.75,
    "overdue_count": 1
  }
}
```

---

### Создание договорённости

```
POST /api/agreements/agreements
```

**Тело запроса:**
```json
{
  "meetingId": "uuid",
  "employeeId": "uuid",
  "title": "Название задачи",
  "description": "Описание (опционально)",
  "responsibleType": "employee_task",
  "priority": 2,
  "dueDate": "2024-01-22"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Договорённость создана",
  "data": {
    "id": "uuid",
    ...
  }
}
```

---

### Статистика сотрудника

```
GET /api/agreements/employees/:id/agreements/stats
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "total": 20,
    "completed": 15,
    "pending": 3,
    "in_progress": 2,
    "overdue": 1,
    "completion_rate": 0.75,
    "by_type": {
      "employee_task": { "total": 12, "completed": 10 },
      "manager_task": { "total": 8, "completed": 5 }
    }
  }
}
```

---

## Типы договорённостей

| Тип | Описание |
|-----|----------|
| `employee_task` | Задача для сотрудника |
| `manager_task` | Задача для руководителя |

---

## Статусы договорённостей

| Статус | Описание |
|--------|----------|
| `pending` | Ожидает выполнения |
| `in_progress` | В процессе |
| `completed` | Выполнено |
| `cancelled` | Отменено |

---

## Приоритеты

| Значение | Описание |
|----------|----------|
| 1 | Критичный |
| 2 | Высокий |
| 3 | Средний (по умолчанию) |
| 4 | Низкий |
| 5 | Минимальный |

---

## Связанная документация

- [Бизнес-описание встреч](../features/meetings.md)
- [API встреч](meetings-api.md)
- [Схема базы данных](../DATABASE.md)

