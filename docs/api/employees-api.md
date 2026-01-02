# API сотрудников (Employees)

## Обзор

API для управления базой сотрудников.

**Base URL:** `/api/employees`

---

## Endpoints

### Получение списка сотрудников

```
GET /api/employees
```

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `team` | string | Фильтр по команде |
| `isActive` | boolean | Только активные (по умолчанию true) |
| `search` | string | Поиск по имени/email |
| `limit` | number | Количество (по умолчанию 50) |
| `offset` | number | Смещение |

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "first_name": "Иван",
      "last_name": "Петров",
      "email": "ivan.petrov@company.com",
      "position": "Senior Developer",
      "team": "Backend",
      "photo_url": "/uploads/photos/ivan.jpg",
      "is_active": true,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ],
  "count": 10
}
```

---

### Получение сотрудника по ID

```
GET /api/employees/:id
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "first_name": "Иван",
    "last_name": "Петров",
    "email": "ivan.petrov@company.com",
    "position": "Senior Developer",
    "team": "Backend",
    "photo_url": "/uploads/photos/ivan.jpg",
    "is_active": true,
    "created_at": "2024-01-01T10:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

---

### Создание сотрудника

```
POST /api/employees
```

**Тело запроса (JSON):**
```json
{
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "ivan.petrov@company.com",
  "position": "Senior Developer",
  "team": "Backend"
}
```

**Тело запроса (multipart/form-data с фото):**
```
firstName: Иван
lastName: Петров
email: ivan.petrov@company.com
position: Senior Developer
team: Backend
photo: [file]
```

**Ответ:**
```json
{
  "success": true,
  "message": "Сотрудник создан",
  "data": {
    "id": "uuid",
    ...
  }
}
```

---

### Обновление сотрудника

```
PUT /api/employees/:id
```

**Тело запроса:**
```json
{
  "firstName": "Иван",
  "lastName": "Петров",
  "position": "Tech Lead",
  "team": "Platform"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Сотрудник обновлён",
  "data": { ... }
}
```

---

### Удаление (деактивация) сотрудника

```
DELETE /api/employees/:id
```

Не удаляет физически, а ставит `is_active = false`.

**Ответ:**
```json
{
  "success": true,
  "message": "Сотрудник деактивирован"
}
```

---

### Статистика

```
GET /api/employees/stats
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "active": 48,
    "inactive": 2,
    "by_team": {
      "Backend": 15,
      "Frontend": 12,
      "QA": 8,
      "Design": 5,
      "Management": 10
    }
  }
}
```

---

### Список команд

```
GET /api/employees/teams
```

**Ответ:**
```json
{
  "success": true,
  "data": [
    "Backend",
    "Frontend",
    "QA",
    "Design",
    "Management"
  ]
}
```

---

### Сотрудники по команде

```
GET /api/employees/team/:team
```

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "first_name": "Иван",
      "last_name": "Петров",
      ...
    }
  ],
  "count": 15
}
```

---

## Валидация

| Поле | Правила |
|------|---------|
| `firstName` | Обязательно, 1-100 символов |
| `lastName` | Обязательно, 1-100 символов |
| `email` | Обязательно, валидный email, уникальный |
| `position` | Опционально, до 200 символов |
| `team` | Опционально, до 200 символов |

---

## Загрузка фото

Фото загружается через `multipart/form-data`:

```javascript
const formData = new FormData();
formData.append('firstName', 'Иван');
formData.append('lastName', 'Петров');
formData.append('email', 'ivan@company.com');
formData.append('photo', fileInput.files[0]);

fetch('/api/employees', {
  method: 'POST',
  body: formData
});
```

**Ограничения:**
- Максимальный размер: 5MB
- Форматы: JPEG, PNG, WebP

---

## Формат ошибок

```json
{
  "success": false,
  "error": "Тип ошибки",
  "message": "Описание",
  "details": [
    { "field": "email", "message": "Email уже существует" }
  ]
}
```

**HTTP коды:**
- `400` — ошибка валидации
- `404` — сотрудник не найден
- `409` — конфликт (дублирующийся email)
- `500` — ошибка сервера

---

## Связанная документация

- [API встреч](meetings-api.md)
- [API характеристик](characteristics-api.md)
- [Схема базы данных](../DATABASE.md)

