-- Создание базы данных O2O для системы one-to-one встреч
-- Версия: 1.0.0

-- Расширения PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица сотрудников
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    position VARCHAR(200) NOT NULL,
    team VARCHAR(200) NOT NULL,
    photo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT employees_email_check CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    CONSTRAINT employees_name_check CHECK (LENGTH(first_name) >= 2 AND LENGTH(last_name) >= 2)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at);

-- Удаляем существующий триггер если есть
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_employees_updated_at 
    BEFORE UPDATE ON employees 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблице и столбцам
COMMENT ON TABLE employees IS 'Таблица сотрудников для системы O2O';
COMMENT ON COLUMN employees.id IS 'Уникальный идентификатор сотрудника';
COMMENT ON COLUMN employees.first_name IS 'Имя сотрудника';
COMMENT ON COLUMN employees.last_name IS 'Фамилия сотрудника';
COMMENT ON COLUMN employees.email IS 'Email сотрудника (уникальный)';
COMMENT ON COLUMN employees.position IS 'Должность сотрудника';
COMMENT ON COLUMN employees.team IS 'Команда/отдел сотрудника';
COMMENT ON COLUMN employees.photo_url IS 'URL фотографии сотрудника';
COMMENT ON COLUMN employees.is_active IS 'Активен ли сотрудник (не уволен)';
COMMENT ON COLUMN employees.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN employees.updated_at IS 'Дата и время последнего обновления записи';
