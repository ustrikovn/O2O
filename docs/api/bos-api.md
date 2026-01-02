# API BOS-анализа

## Обзор

API для работы с BOS (Behavioral Observation Scale) — автоматическим анализом поведения сотрудников на встречах.

**Base URL:** `/api/meetings` (BOS endpoints интегрированы в meetings API)

---

## Endpoints

### Получение BOS-наблюдения

```
GET /api/meetings/:id/bos
```

Возвращает результат BOS-анализа для конкретной встречи.

**Ответ (анализ завершён):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "meeting_id": "uuid",
    "employee_id": "uuid",
    "status": "completed",
    "error_message": null,
    "scores": {
      "problem_articulation": { "score": 4, "evidence": "Чётко назвал проблему с дедлайнами" },
      "interest_articulation": { "score": 3, "evidence": "Упомянул интерес к новым технологиям" },
      "proactive_communication": { "score": null, "evidence": null },
      "collaborative_behavior": { "score": 5, "evidence": "Помог коллеге с задачей" },
      "feedback_receptivity": { "score": 4, "evidence": "Принял обратную связь конструктивно" },
      "task_ownership": { "score": 4, "evidence": "Взял ответственность за результат" },
      "goal_alignment": { "score": 3, "evidence": null },
      "learning_agility": { "score": 5, "evidence": "Хочет изучить TypeScript" },
      "decision_quality": { "score": null, "evidence": null },
      "emotional_intelligence": { "score": 4, "evidence": "Понимает состояние команды" },
      "commitment_to_agreements": { "score": 5, "evidence": "Выполнил все договорённости с прошлой встречи" },
      "strategic_thinking": { "score": 3, "evidence": null }
    },
    "metadata": {
      "model": "claude-sonnet-4-20250514",
      "generation_time_ms": 2800,
      "input_data": {
        "notes_length": 450,
        "agreements_count": 3
      }
    },
    "created_at": "2024-01-15T11:15:00Z",
    "completed_at": "2024-01-15T11:15:30Z"
  }
}
```

**Ответ (анализ в процессе):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "meeting_id": "uuid",
    "status": "processing",
    "scores": {},
    "created_at": "2024-01-15T11:15:00Z",
    "completed_at": null
  }
}
```

**Ответ (данных нет):**
```json
{
  "success": true,
  "data": null
}
```

**Ответ (ошибка анализа):**
```json
{
  "success": true,
  "data": {
    "status": "failed",
    "error_message": "LLM timeout after 30s"
  }
}
```

---

### Перезапуск анализа

```
POST /api/meetings/:id/bos/retry
```

Удаляет существующее наблюдение и запускает анализ заново.

**Требования:**
- Встреча должна существовать
- Встреча должна быть в статусе `completed`

**Ответ:**
```json
{
  "success": true,
  "message": "BOS-анализ перезапущен"
}
```

**Ошибка (встреча не завершена):**
```json
{
  "success": false,
  "error": "Неверный статус",
  "message": "BOS-анализ возможен только для завершённых встреч"
}
```

---

### История BOS сотрудника

```
GET /api/meetings/employees/:employeeId/bos-history
```

Возвращает историю BOS-наблюдений для сотрудника.

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
    },
    {
      "id": "uuid",
      "meeting_id": "uuid",
      "status": "completed",
      "scores": {...},
      "created_at": "2024-01-08T11:20:00Z"
    }
  ],
  "count": 2
}
```

---

## Формат scores

### Структура оценки

```json
{
  "behavior_key": {
    "score": 1-5 | null,
    "evidence": "Цитата/факт из заметок" | null
  }
}
```

- `score`: Оценка 1-5 или `null` если поведение не наблюдалось
- `evidence`: Краткое доказательство (до 200 символов)

### 12 поведений

| Ключ | Название | Шкала |
|------|----------|-------|
| `problem_articulation` | Выражение проблем | 1=Никогда → 5=Активно |
| `interest_articulation` | Выражение интересов | 1=Никогда → 5=Постоянно |
| `proactive_communication` | Инициативная коммуникация | 1=Пассивен → 5=Инициативен |
| `collaborative_behavior` | Сотрудничество | 1=Изолирован → 5=Активно помогает |
| `feedback_receptivity` | Восприимчивость к ОС | 1=Защищается → 5=Открыт |
| `task_ownership` | Ответственность | 1=Избегает → 5=Берёт на себя |
| `goal_alignment` | Согласованность целей | 1=Не связывает → 5=Ориентирован |
| `learning_agility` | Готовность к обучению | 1=Избегает → 5=Ищет |
| `decision_quality` | Качество решений | 1=Нужна помощь → 5=Самостоятелен |
| `emotional_intelligence` | Эмоц. интеллект | 1=Не осознаёт → 5=Высокий |
| `commitment_to_agreements` | Соблюдение договорённостей | 1=Не выполняет → 5=Всегда |
| `strategic_thinking` | Стратегическое мышление | 1=Тактически → 5=Стратегически |

---

## Статусы обработки

| Статус | Описание | Что делать |
|--------|----------|------------|
| `pending` | В очереди | Подождать |
| `processing` | LLM обрабатывает | Подождать (обычно 5-30 сек) |
| `completed` | Готово | Результаты доступны |
| `failed` | Ошибка | Можно перезапустить через /retry |

---

## Polling статуса

Если статус `pending` или `processing`, можно использовать polling:

```javascript
async function pollBOSStatus(meetingId) {
  const response = await fetch(`/api/meetings/${meetingId}/bos`);
  const result = await response.json();
  
  if (result.data?.status === 'processing') {
    // Повторить через 5 секунд
    setTimeout(() => pollBOSStatus(meetingId), 5000);
  } else if (result.data?.status === 'completed') {
    // Показать результаты
    renderBOSScores(result.data.scores);
  }
}
```

---

## Автоматический запуск

BOS-анализ запускается автоматически при завершении встречи:

```
POST /api/meetings/:id/end  →  BOSService.triggerAnalysis()
```

Анализ работает асинхронно и не блокирует ответ API.

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

- [Бизнес-описание BOS](../features/bos-analysis.md)
- [API встреч](meetings-api.md)
- [Схема базы данных](../DATABASE.md)

