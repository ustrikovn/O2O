-- Создание схемы для системы опросов
-- Версия: 1.0
-- Дата: 2025-09-19

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
    CONSTRAINT fk_survey_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_survey_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
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
CREATE INDEX IF NOT EXISTS idx_survey_results_meeting_id ON survey_results(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_results_status ON survey_results(status);
CREATE INDEX IF NOT EXISTS idx_survey_results_started_at ON survey_results(started_at);

CREATE INDEX IF NOT EXISTS idx_survey_templates_category ON survey_templates(category);
CREATE INDEX IF NOT EXISTS idx_survey_templates_public ON survey_templates(is_public) WHERE is_public = true;

-- GIN индексы для JSONB полей (для быстрого поиска)
CREATE INDEX IF NOT EXISTS idx_surveys_questions_gin ON surveys USING GIN (questions);
CREATE INDEX IF NOT EXISTS idx_surveys_metadata_gin ON surveys USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_survey_results_answers_gin ON survey_results USING GIN (answers);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

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
