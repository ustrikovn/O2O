# API встреч (Meetings)

## Обзор

API для управления one-to-one встречами. Все данные встречи (заметки, договорённости) хранятся в JSON-поле `content`.

**Base URL:** `/api/meetings`

---

## Endpoints

### Создание встречи

```
POST /api/meetings
```

**Тело запроса:**
```json
{
  "employeeId": "uuid"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Встреча создана",
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "status": "scheduled",
    "content": {},
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### Получение списка встреч

```
GET /api/meetings
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `employeeId` | UUID | Фильтр по сотруднику |
| `status` | string | scheduled, active, completed, cancelled |
| `limit` | number | Количество (по умолчанию 50) |
| `offset` | number | Смещение |

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "status": "completed",
      "started_at": "2024-01-15T10:30:00Z",
      "ended_at": "2024-01-15T11:15:00Z",
      "content": {
        "notes": "...",
        "agreements": [...]
      }
    }
  ],
  "count": 10
}
```

---

### Получение встречи по ID

```
GET /api/meetings/:id
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "status": "completed",
    "started_at": "2024-01-15T10:30:00Z",
    "ended_at": "2024-01-15T11:15:00Z",
    "content": {
      "notes": "Обсудили план развития. Иван хочет стать тимлидом.",
      "agreements": [
        {
          "id": "agreement-1",
          "title": "Изучить книгу по менеджменту",
          "type": "employee_task",
          "created_at": "2024-01-15T10:50:00Z"
        }
      ]
    }
  }
}
```

---

### Начало встречи

```
POST /api/meetings/:id/start
```

Переводит встречу в статус `active`, фиксирует `started_at`.

**Ответ:**
```json
{
  "success": true,
  "message": "Встреча начата",
  "data": {
    "id": "uuid",
    "status": "active",
    "started_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### Завершение встречи

```
POST /api/meetings/:id/end
```

Переводит в статус `completed`, фиксирует `ended_at`, запускает BOS-анализ.

**Ответ:**
```json
{
  "success": true,
  "message": "Встреча завершена",
  "data": {
    "id": "uuid",
    "status": "completed",
    "ended_at": "2024-01-15T11:15:00Z"
  }
}
```

**Важно:** BOS-анализ запускается асинхронно и не блокирует ответ.

---

### Обновление заметок

```
PUT /api/meetings/:id/notes
```

**Тело запроса:**
```json
{
  "notes": "Текст заметок руководителя..."
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Заметки обновлены"
}
```

---

### Добавление договорённости

```
POST /api/meetings/:id/agreements
```

**Тело запроса:**
```json
{
  "title": "Название задачи",
  "description": "Описание (опционально)",
  "type": "employee_task"
}
```

Типы: `employee_task`, `manager_task`

**Ответ:**
```json
{
  "success": true,
  "message": "Договорённость добавлена"
}
```

---

### Обновление договорённости

```
PUT /api/meetings/:id/agreements
```

**Тело запроса:**
```json
{
  "agreementId": "agreement-uuid",
  "title": "Новое название",
  "description": "Новое описание",
  "type": "manager_task"
}
```

---

### Удаление договорённости

```
DELETE /api/meetings/:id/agreements/:agreementId
```

---

### Отмена встречи

```
DELETE /api/meetings/:id
```

Переводит встречу в статус `cancelled`.

---

### Получение активной встречи

```
GET /api/meetings/active
```

Возвращает текущую активную встречу (если есть).

---

### Активная встреча для сотрудника

```
GET /api/meetings/active-for-employee/:employeeId
```

Проверяет, есть ли активная встреча с указанным сотрудником.

---

### Статистика встреч

```
GET /api/meetings/stats
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "completed": 85,
    "active": 1,
    "scheduled": 14
  }
}
```

---

### Статистика по сотруднику

```
GET /api/meetings/employees/:employeeId/stats
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "total_meetings": 12,
    "completed_meetings": 10,
    "average_duration_minutes": 45,
    "last_meeting_date": "2024-01-15"
  }
}
```

---

### Последние договорённости сотрудника

```
GET /api/meetings/employees/:employeeId/last-agreements
```

Возвращает договорённости из последних встреч с сотрудником.

---

## BOS Endpoints

### Получение BOS-наблюдения

```
GET /api/meetings/:id/bos
```

**Ответ (completed):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "meeting_id": "uuid",
    "status": "completed",
    "scores": {
      "problem_articulation": { "score": 4, "evidence": "Чётко назвал проблему" },
      "interest_articulation": { "score": 3, "evidence": null },
      "proactive_communication": { "score": null, "evidence": null },
      ...
    },
    "created_at": "2024-01-15T11:15:00Z",
    "completed_at": "2024-01-15T11:15:30Z"
  }
}
```

**Ответ (нет данных):**
```json
{
  "success": true,
  "data": null
}
```

---

### Перезапуск BOS-анализа

```
POST /api/meetings/:id/bos/retry
```

Удаляет существующее наблюдение и запускает анализ заново.

**Ответ:**
```json
{
  "success": true,
  "message": "BOS-анализ перезапущен"
}
```

---

### История BOS для сотрудника

```
GET /api/meetings/employees/:employeeId/bos-history
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `limit` | number | Количество (по умолчанию 20) |
| `offset` | number | Смещение |

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "meeting_id": "uuid",
      "status": "completed",
      "scores": {...},
      "created_at": "2024-01-15T11:15:00Z"
    }
  ],
  "count": 5
}
```

---

## Статусы встреч

| Статус | Описание |
|--------|----------|
| `scheduled` | Запланирована |
| `active` | Активна (идёт) |
| `completed` | Завершена |
| `cancelled` | Отменена |

---

## Формат ошибок

```json
{
  "success": false,
  "error": "Тип ошибки",
  "message": "Описание ошибки"
}
```

**HTTP коды:**
- `400` — ошибка валидации
- `404` — встреча не найдена
- `409` — конфликт (например, уже есть активная встреча)
- `500` — ошибка сервера

---

## Связанная документация

- [Бизнес-описание встреч](../features/meetings.md)
- [BOS-анализ](../features/bos-analysis.md)
- [BOS API](bos-api.md)
- [Схема базы данных](../DATABASE.md)

