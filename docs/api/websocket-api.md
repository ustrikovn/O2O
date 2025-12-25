# WebSocket API (AI-ассистент)

## Обзор

WebSocket API для real-time взаимодействия с AI-ассистентом во время one-to-one встреч.

**URL:** `ws://localhost:3001/ws`

---

## Подключение

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = () => {
  console.log('Connected to assistant');
};

ws.onclose = () => {
  console.log('Disconnected');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

---

## Формат сообщений

Все сообщения в формате JSON:

```json
{
  "type": "event_type",
  "payload": { ... }
}
```

---

## События от клиента к серверу

### subscribe

Подписка на встречу. Обязательно для начала работы.

```json
{
  "type": "subscribe",
  "payload": {
    "meetingId": "uuid",
    "employeeId": "uuid"
  }
}
```

### notes_updated

Отправляется при изменении заметок (рекомендуется с debounce 500-1000ms).

```json
{
  "type": "notes_updated",
  "payload": {
    "meetingId": "uuid",
    "employeeId": "uuid",
    "notes": "Текст заметок..."
  }
}
```

### typing

Сигнал о том, что пользователь печатает (для throttling ассистента).

```json
{
  "type": "typing",
  "payload": {
    "meetingId": "uuid"
  }
}
```

### unsubscribe

Отписка от встречи.

```json
{
  "type": "unsubscribe",
  "payload": {
    "meetingId": "uuid"
  }
}
```

---

## События от сервера к клиенту

### assistant_typing

Ассистент "думает" (LLM обрабатывает).

```json
{
  "type": "assistant_typing",
  "payload": {
    "meetingId": "uuid"
  }
}
```

### assistant_message

Сообщение от ассистента.

```json
{
  "type": "assistant_message",
  "payload": {
    "meetingId": "uuid",
    "message": {
      "id": "uuid",
      "text": "💡 Третья встреча с упоминанием перегрузки. Стоит обсудить делегирование.",
      "type": "insight",
      "priority": "high",
      "timestamp": "2024-01-15T10:45:00Z"
    }
  }
}
```

### assistant_action_card

Предложение действия (запустить опрос, добавить договорённость).

```json
{
  "type": "assistant_action_card",
  "payload": {
    "meetingId": "uuid",
    "card": {
      "id": "uuid",
      "kind": "start_survey",
      "title": "Запустить DISC-профилирование",
      "subtitle": "Поможет лучше понять стиль общения",
      "cta": {
        "label": "Запустить",
        "action": "start_survey",
        "params": { "surveyId": "uuid" }
      }
    }
  }
}
```

### error

Ошибка обработки.

```json
{
  "type": "error",
  "payload": {
    "code": "INVALID_MEETING",
    "message": "Встреча не найдена"
  }
}
```

### subscribed

Подтверждение подписки.

```json
{
  "type": "subscribed",
  "payload": {
    "meetingId": "uuid",
    "employeeId": "uuid"
  }
}
```

---

## Типы сообщений ассистента

| Тип | Описание | Иконка |
|-----|----------|--------|
| `proactive_question` | Предложение вопроса | ❓ |
| `warning` | Предупреждение о риске | ⚠️ |
| `insight` | Наблюдение/инсайт | 💡 |
| `action_card` | Предложение действия | 🎯 |

---

## Типы action_card

| Kind | Описание |
|------|----------|
| `start_survey` | Запустить опрос |
| `add_agreement` | Добавить договорённость |
| `ask_followup` | Задать уточняющий вопрос |

---

## Пример клиента

```javascript
class AssistantClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.setupHandlers();
  }

  setupHandlers() {
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'assistant_message':
          this.onMessage(data.payload.message);
          break;
        case 'assistant_typing':
          this.onTyping();
          break;
        case 'assistant_action_card':
          this.onActionCard(data.payload.card);
          break;
        case 'error':
          this.onError(data.payload);
          break;
      }
    };
  }

  subscribe(meetingId, employeeId) {
    this.send('subscribe', { meetingId, employeeId });
  }

  updateNotes(meetingId, employeeId, notes) {
    this.send('notes_updated', { meetingId, employeeId, notes });
  }

  send(type, payload) {
    this.ws.send(JSON.stringify({ type, payload }));
  }

  onMessage(message) {
    // Показать сообщение в UI
    console.log('Assistant:', message.text);
  }

  onTyping() {
    // Показать индикатор "печатает"
  }

  onActionCard(card) {
    // Показать карточку действия
  }

  onError(error) {
    console.error('Assistant error:', error);
  }
}

// Использование
const assistant = new AssistantClient('ws://localhost:3001/ws');
assistant.subscribe('meeting-uuid', 'employee-uuid');

// При изменении заметок (с debounce)
notesInput.addEventListener('input', debounce(() => {
  assistant.updateNotes(meetingId, employeeId, notesInput.value);
}, 1000));
```

---

## Throttling и политики

### Со стороны сервера

- **Минимум 2.5 секунды** между ответами ассистента
- **Максимум 10 сообщений** за сессию встречи
- Ассистент **молчит в 70-80%** случаев (by design)

### Рекомендации для клиента

- Debounce на отправку `notes_updated`: 500-1000ms
- Не отправлять `typing` чаще раза в секунду
- Показывать индикатор "ассистент думает" при `assistant_typing`

---

## Переподключение

При разрыве соединения рекомендуется:

```javascript
function connect() {
  const ws = new WebSocket('ws://localhost:3001/ws');
  
  ws.onclose = () => {
    // Переподключение через 3 секунды
    setTimeout(connect, 3000);
  };
  
  return ws;
}
```

---

## Связанная документация

- [Бизнес-описание ассистента](../features/assistant.md)
- [LLM Pipeline](../llm-pipeline-spec.md)
- [Архитектура](../ARCHITECTURE.md)
