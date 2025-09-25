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

-- ========================================
-- СХЕМА ТАБЛИЦ ДЛЯ СИСТЕМЫ ОПРОСОВ
-- ========================================

-- Таблица опросов
CREATE TABLE IF NOT EXISTS surveys (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- JSON содержимое опроса
    questions JSONB NOT NULL,
    logic JSONB NOT NULL,
    settings JSONB,
    
    -- Метаданные
    metadata JSONB,
    version VARCHAR(50) DEFAULT '1.0.0',
    category VARCHAR(100),
    estimated_duration INTEGER, -- в минутах
    author VARCHAR(255),
    tags TEXT[],
    
    -- Состояние
    is_active BOOLEAN DEFAULT true,
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица результатов опросов
CREATE TABLE IF NOT EXISTS survey_results (
    id VARCHAR(255) PRIMARY KEY,
    survey_id VARCHAR(255) NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Связи
    employee_id UUID, -- NULL если анонимный опрос
    meeting_id UUID,  -- NULL если не связан с встречей
    
    -- Ответы и результаты
    answers JSONB NOT NULL DEFAULT '[]',
    
    -- Состояние прохождения
    status VARCHAR(20) DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed', 'abandoned')),
    current_question_id VARCHAR(255),
    
    -- Временные метки
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Метаданные сессии
    metadata JSONB,
    
    -- Ограничения
    CONSTRAINT fk_survey_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- Таблица шаблонов опросов (предустановленные опросы)
CREATE TABLE IF NOT EXISTS survey_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_surveys_active ON surveys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_surveys_category ON surveys(category);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON surveys(created_at);

CREATE INDEX IF NOT EXISTS idx_survey_results_survey_id ON survey_results(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_results_employee_id ON survey_results(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_results_status ON survey_results(status);
CREATE INDEX IF NOT EXISTS idx_survey_results_started_at ON survey_results(started_at);

CREATE INDEX IF NOT EXISTS idx_survey_templates_category ON survey_templates(category);
CREATE INDEX IF NOT EXISTS idx_survey_templates_public ON survey_templates(is_public) WHERE is_public = true;

-- GIN индексы для JSONB полей (для быстрого поиска)
CREATE INDEX IF NOT EXISTS idx_surveys_questions_gin ON surveys USING GIN (questions);
CREATE INDEX IF NOT EXISTS idx_surveys_metadata_gin ON surveys USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_survey_results_answers_gin ON survey_results USING GIN (answers);

-- Триггеры для автоматического обновления временных меток
CREATE TRIGGER update_surveys_updated_at 
    BEFORE UPDATE ON surveys 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_survey_templates_updated_at 
    BEFORE UPDATE ON survey_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для обновления last_activity_at в survey_results
CREATE OR REPLACE FUNCTION update_survey_result_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_survey_results_activity 
    BEFORE UPDATE ON survey_results 
    FOR EACH ROW 
    EXECUTE FUNCTION update_survey_result_activity();

-- Представление для статистики опросов
CREATE OR REPLACE VIEW survey_statistics AS
SELECT 
    s.id as survey_id,
    s.title,
    s.category,
    COUNT(sr.id) as total_responses,
    COUNT(CASE WHEN sr.status = 'completed' THEN 1 END) as completed_responses,
    COUNT(CASE WHEN sr.status = 'abandoned' THEN 1 END) as abandoned_responses,
    COUNT(CASE WHEN sr.status IN ('started', 'in_progress') THEN 1 END) as in_progress_responses,
    ROUND(
        COUNT(CASE WHEN sr.status = 'completed' THEN 1 END)::numeric / 
        NULLIF(COUNT(sr.id), 0) * 100, 2
    ) as completion_rate,
    AVG(
        CASE 
            WHEN sr.status = 'completed' AND sr.completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (sr.completed_at - sr.started_at)) / 60 
        END
    ) as avg_duration_minutes,
    MIN(sr.started_at) as first_response_at,
    MAX(sr.last_activity_at) as last_activity_at
FROM surveys s
LEFT JOIN survey_results sr ON s.id = sr.survey_id
WHERE s.is_active = true
GROUP BY s.id, s.title, s.category;

-- Комментарии к таблицам
COMMENT ON TABLE surveys IS 'Таблица опросов и анкет для профилирования сотрудников';
COMMENT ON TABLE survey_results IS 'Результаты прохождения опросов сотрудниками';
COMMENT ON TABLE survey_templates IS 'Шаблоны опросов для быстрого создания';
COMMENT ON VIEW survey_statistics IS 'Статистика по опросам: количество ответов, процент завершения и т.д.';

-- Комментарии к основным колонкам
COMMENT ON COLUMN surveys.questions IS 'JSON структура с вопросами опроса';
COMMENT ON COLUMN surveys.logic IS 'JSON с логикой переходов между вопросами';
COMMENT ON COLUMN surveys.settings IS 'JSON с настройками опроса (возврат, прогресс и т.д.)';

COMMENT ON COLUMN survey_results.answers IS 'JSON массив с ответами на вопросы';
COMMENT ON COLUMN survey_results.current_question_id IS 'ID текущего вопроса для незавершенных опросов';
