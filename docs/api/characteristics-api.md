# API характеристик (Characteristics)

## Обзор

API для управления AI-сгенерированными характеристиками сотрудников.

**Base URL:** `/api/characteristics`

---

## Endpoints

### Получение характеристики

```
GET /api/characteristics/:employeeId
```

**Ответ (найдено):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "content": "Иван — прямой и целеустремлённый сотрудник типа D по DISC...\n\nСИЛЬНЫЕ СТОРОНЫ:\n• Берёт ответственность за результат\n• Быстро адаптируется...\n\nРЕКОМЕНДАЦИИ:\n• Давать сложные задачи с чёткими целями...",
    "metadata": {
      "generation_metadata": {
        "model": "gpt-4o",
        "context_fingerprint": "abc123def",
        "generation_time_ms": 3500,
        "sources": {
          "disc_results": 1,
          "bigfive_results": 1,
          "meetings_count": 5,
          "agreements_count": 12
        }
      }
    },
    "created_at": "2024-01-10T10:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

**Ответ (не найдено):**
```json
{
  "success": false,
  "error": "Не найдено",
  "message": "Характеристика для этого сотрудника еще не создана"
}
```

---

### Генерация характеристики

```
POST /api/characteristics/:employeeId/generate
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `force` | boolean | Принудительная регенерация |
| `excludeBigFive` | boolean | Не учитывать Big Five |

**Логика работы:**

1. Вычисляется fingerprint текущего контекста (опросы, встречи)
2. Если fingerprint не изменился — возвращается существующая характеристика
3. Если изменился или `force=true` — генерируется новая

**Ответ (создана новая):**
```json
{
  "success": true,
  "message": "Характеристика создана",
  "data": { ... }
}
```

**Ответ (обновлена):**
```json
{
  "success": true,
  "message": "Характеристика обновлена",
  "data": { ... }
}
```

**Ответ (без изменений):**
```json
{
  "success": true,
  "message": "Контекст не изменился, регенерация не требуется",
  "data": { ... }
}
```

---

### Удаление характеристики

```
DELETE /api/characteristics/:employeeId
```

**Ответ:**
```json
{
  "success": true,
  "message": "Характеристика удалена"
}
```

---

### Список всех характеристик

```
GET /api/characteristics
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `limit` | number | Количество |
| `offset` | number | Смещение |

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "content": "...",
      "updated_at": "2024-01-15T11:00:00Z"
    }
  ],
  "count": 10
}
```

---

## Структура metadata

```json
{
  "generation_metadata": {
    "model": "gpt-4o",
    "context_fingerprint": "sha256-hash",
    "generation_time_ms": 3500,
    "sources": {
      "disc_results": 1,
      "bigfive_results": 1,
      "meetings_count": 5,
      "agreements_count": 12
    }
  }
}
```

| Поле | Описание |
|------|----------|
| `model` | Модель LLM |
| `context_fingerprint` | Хэш контекста для проверки изменений |
| `generation_time_ms` | Время генерации |
| `sources` | Источники данных |

---

## Автообновление

Характеристика автоматически обновляется при:

1. Завершении опроса DISC или Big Five
2. (Опционально) Накоплении N новых встреч

Триггер вызывает `/generate` без флага `force`.

---

## Формат ошибок

```json
{
  "success": false,
  "error": "Тип ошибки",
  "message": "Описание"
}
```

---

## Связанная документация

- [Бизнес-описание характеристик](../features/characteristics.md)
- [API опросов](surveys-api.md)
- [Схема базы данных](../DATABASE.md)

