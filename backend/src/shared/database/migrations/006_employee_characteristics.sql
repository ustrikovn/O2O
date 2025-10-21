-- Таблица характеристик сотрудников
-- Версия: 1.0.0
-- Хранит сгенерированные LLM характеристики с историей изменений

-- Удаляем таблицу если существует
DROP TABLE IF EXISTS employee_characteristics CASCADE;

-- Создаем таблицу характеристик
CREATE TABLE employee_characteristics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Основной контент характеристики
    content TEXT NOT NULL,
    
    -- Предыдущая версия характеристики
    previous_content TEXT,
    
    -- Краткое описание изменений между версиями
    changes_summary TEXT,
    
    -- Метаданные о источниках данных
    metadata JSONB DEFAULT '{}'::jsonb,
    /*
    Структура metadata:
    {
      "sources": {
        "meetings_count": 5,
        "surveys_count": 2,
        "last_meeting_date": "2024-01-15T10:00:00Z",
        "last_survey_date": "2024-01-10T15:30:00Z"
      },
      "data_richness_score": 75,  // 0-100, индикатор наполненности
      "generation_metadata": {
        "model": "gpt-4o",
        "tokens_used": 1500,
        "generation_time_ms": 3500
      }
    }
    */
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT employee_characteristics_unique_employee UNIQUE (employee_id),
    CONSTRAINT employee_characteristics_content_length CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 10000)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_employee_characteristics_employee_id ON employee_characteristics(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_characteristics_updated_at ON employee_characteristics(updated_at);
CREATE INDEX IF NOT EXISTS idx_employee_characteristics_metadata_gin ON employee_characteristics USING GIN(metadata);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_employee_characteristics_updated_at 
    BEFORE UPDATE ON employee_characteristics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Функция для автоматического сохранения предыдущей версии
CREATE OR REPLACE FUNCTION save_previous_characteristic()
RETURNS TRIGGER AS $$
BEGIN
    -- Сохраняем старый контент в previous_content при обновлении
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.previous_content = OLD.content;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для сохранения предыдущей версии
CREATE TRIGGER save_previous_characteristic_trigger
    BEFORE UPDATE ON employee_characteristics
    FOR EACH ROW
    EXECUTE FUNCTION save_previous_characteristic();

-- Комментарии к таблице и столбцам
COMMENT ON TABLE employee_characteristics IS 'Характеристики сотрудников, сгенерированные LLM на основе встреч, опросов и роли';
COMMENT ON COLUMN employee_characteristics.id IS 'Уникальный идентификатор характеристики';
COMMENT ON COLUMN employee_characteristics.employee_id IS 'ID сотрудника (уникальная связь)';
COMMENT ON COLUMN employee_characteristics.content IS 'Текст характеристики сотрудника';
COMMENT ON COLUMN employee_characteristics.previous_content IS 'Предыдущая версия характеристики для сравнения';
COMMENT ON COLUMN employee_characteristics.changes_summary IS 'Краткое описание что изменилось между версиями';
COMMENT ON COLUMN employee_characteristics.metadata IS 'Метаданные: источники данных, показатель наполненности, информация о генерации';
COMMENT ON COLUMN employee_characteristics.created_at IS 'Дата создания первой характеристики';
COMMENT ON COLUMN employee_characteristics.updated_at IS 'Дата последнего обновления характеристики';

