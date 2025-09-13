# Troubleshooting базы данных O2O

## ⚠️ КРИТИЧЕСКИ ВАЖНО

База данных в проекте O2O работает **ТОЛЬКО** через Docker контейнер. 

## Правильный порядок запуска

### 1. Запуск Docker PostgreSQL
```bash
cd /Users/miuli/Desktop/O2O
docker-compose up postgres -d
```

### 2. Проверка конфликта портов
```bash
lsof -i :5432
```

**Если видите и локальную PostgreSQL, и Docker:**
```
postgres    690 miuli    # <- ЛОКАЛЬНАЯ (убрать!)
com.docke 24142 miuli    # <- DOCKER (нужная)
```

**Решение:** Остановить локальную PostgreSQL:
```bash
kill 690  # заменить на реальный PID
```

### 3. Проверка подключения к Docker базе
```bash
PGPASSWORD=o2o_secure_password_2024 psql -h localhost -p 5432 -U o2o_user -d o2o_db -c "SELECT COUNT(*) FROM employees;"
```

Должно вернуть количество сотрудников (обычно 4-5).

## Настройки backend/.env

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=o2o_db
DB_USER=o2o_user
DB_PASSWORD=o2o_secure_password_2024
```

## Частые ошибки

### ❌ "role o2o_user does not exist"
**Причина:** Бэкенд подключается к локальной PostgreSQL вместо Docker  
**Решение:** Остановить локальную PostgreSQL

### ❌ "relation employees does not exist" 
**Причина:** Подключение к пустой локальной базе  
**Решение:** Использовать Docker базу с существующими данными

### ❌ "column is_active does not exist"
**Причина:** Неправильная схема базы данных  
**Решение:** НЕ создавать новые таблицы, использовать существующую Docker базу

## Проверка работоспособности

1. **Docker контейнер запущен:**
   ```bash
   docker ps | grep postgres
   ```

2. **Бэкенд подключился к базе:**
   ```bash
   curl -s http://localhost:3001/api/health
   ```

3. **API возвращает данные:**
   ```bash
   curl -s http://localhost:3001/api/employees | jq length
   ```

## НЕ ДЕЛАТЬ

- ❌ НЕ создавать новые базы данных
- ❌ НЕ запускать миграции на пустой базе  
- ❌ НЕ менять настройки без понимания архитектуры
- ❌ НЕ подключаться к локальной PostgreSQL

## Структура существующей базы

В Docker базе уже есть:
- Таблица `employees` с 4-5 сотрудниками
- Таблица `meetings` с JSON структурой
- Все необходимые индексы и триггеры

**ВАЖНО:** Данные уже существуют - не создавать заново!
