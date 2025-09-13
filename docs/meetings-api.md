# API для управления встречами

## Обзор

API для управления one-to-one встречами предоставляет полный функционал для:
- Создания и управления встречами
- Начала и завершения встреч
- Добавления заметок и договоренностей
- Получения статистики

## Основные endpoints

### Встречи

#### `POST /api/meetings`
Создание новой встречи

**Тело запроса:**
```json
{
  "employeeId": "uuid",
  "title": "string (опционально)",
  "location": "string (опционально)", 
  "scheduledAt": "ISO 8601 дата (опционально)"
}
```

#### `GET /api/meetings`
Получение списка встреч с фильтрацией

**Query параметры:**
- `employeeId` - UUID сотрудника
- `status` - статус встречи (scheduled, active, completed, cancelled)
- `dateFrom` - дата начала периода
- `dateTo` - дата окончания периода
- `satisfactionRatingMin` - минимальная оценка удовлетворенности
- `satisfactionRatingMax` - максимальная оценка удовлетворенности
- `limit` - количество записей (по умолчанию 50)
- `offset` - смещение для пагинации

#### `GET /api/meetings/:id`
Получение детальной информации о встрече с заметками и договоренностями

#### `PUT /api/meetings/:id`
Обновление данных встречи

#### `POST /api/meetings/:id/start`
Начать встречу

**Тело запроса:**
```json
{
  "startedAt": "ISO 8601 дата (опционально)"
}
```

#### `POST /api/meetings/:id/end`
Завершить встречу

**Тело запроса:**
```json
{
  "endedAt": "ISO 8601 дата (опционально)",
  "summary": "string (опционально)",
  "satisfactionRating": "number 1-10 (опционально)"
}
```

#### `DELETE /api/meetings/:id`
Отмена встречи

### Заметки

#### `POST /api/meetings/:id/notes`
Добавление заметки к встрече

**Тело запроса:**
```json
{
  "content": "string (обязательно)",
  "noteType": "general|feedback|observation|concern (опционально)",
  "tags": ["string"] 
}
```

#### `PUT /api/meetings/notes/:noteId`
Обновление заметки

#### `DELETE /api/meetings/notes/:noteId`
Удаление заметки

### Договоренности

#### `POST /api/meetings/:id/agreements`
Добавление договоренности к встрече

**Тело запроса:**
```json
{
  "title": "string (обязательно)",
  "description": "string (опционально)",
  "agreementType": "employee_task|manager_task|mutual_agreement",
  "priority": "number 1-5 (опционально, по умолчанию 3)",
  "dueDate": "ISO 8601 дата (опционально)",
  "parentAgreementId": "uuid (опционально)"
}
```

#### `PUT /api/meetings/agreements/:agreementId`
Обновление договоренности

#### `POST /api/meetings/agreements/:agreementId/complete`
Завершение договоренности

#### `GET /api/meetings/agreements`
Получение договоренностей с фильтрацией

**Query параметры:**
- `meetingId` - UUID встречи
- `status` - статус договоренности
- `agreementType` - тип договоренности
- `priority` - приоритет
- `dueDateFrom` - дата начала периода срока выполнения
- `dueDateTo` - дата окончания периода срока выполнения
- `overdue` - только просроченные (true/false)

### Статистика

#### `GET /api/meetings/stats`
Общая статистика встреч

#### `GET /api/meetings/agreements/stats`
Статистика договоренностей

#### `GET /api/meetings/employees/:employeeId/stats`
Статистика встреч по конкретному сотруднику

## Статусы встреч

- `scheduled` - запланирована
- `active` - активна (идет)
- `completed` - завершена
- `cancelled` - отменена

## Статусы договоренностей

- `pending` - ожидает выполнения
- `in_progress` - в процессе выполнения
- `completed` - завершена
- `cancelled` - отменена

## Типы договоренностей

- `employee_task` - задача для сотрудника
- `manager_task` - задача для руководителя
- `mutual_agreement` - взаимное соглашение

## Типы заметок

- `general` - общая заметка
- `feedback` - обратная связь
- `observation` - наблюдение
- `concern` - проблема/беспокойство

## Примеры использования

### Создание и проведение встречи

1. **Создать встречу:**
```bash
POST /api/meetings
{
  "employeeId": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Weekly 1:1",
  "scheduledAt": "2024-01-15T10:00:00Z"
}
```

2. **Начать встречу:**
```bash
POST /api/meetings/meeting-id/start
```

3. **Добавить заметки:**
```bash
POST /api/meetings/meeting-id/notes
{
  "content": "Сотрудник высказал беспокойство по поводу рабочей нагрузки",
  "noteType": "concern",
  "tags": ["workload", "stress"]
}
```

4. **Добавить договоренность:**
```bash
POST /api/meetings/meeting-id/agreements
{
  "title": "Пересмотреть распределение задач",
  "agreementType": "manager_task",
  "priority": 2,
  "dueDate": "2024-01-22"
}
```

5. **Завершить встречу:**
```bash
POST /api/meetings/meeting-id/end
{
  "summary": "Обсудили рабочую нагрузку, договорились о перераспределении задач",
  "satisfactionRating": 8
}
```

## Ошибки

Все endpoints возвращают стандартизированный формат ошибок:

```json
{
  "error": "Тип ошибки",
  "message": "Описание ошибки",
  "details": [
    {
      "field": "название поля",
      "message": "описание ошибки поля"
    }
  ]
}
```

Коды ошибок:
- `400` - Ошибка валидации данных
- `404` - Ресурс не найден
- `409` - Конфликт (например, попытка начать встречу, когда уже есть активная)
- `500` - Внутренняя ошибка сервера
