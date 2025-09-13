-- Полностью JSON схема для системы one-to-one встреч
-- Версия: 4.0.0 (всё в JSON)

-- Расширения PostgreSQL (если еще не созданы)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Удаляем старые таблицы если они есть
DROP TABLE IF EXISTS meeting_agreements CASCADE;
DROP TABLE IF EXISTS meeting_notes CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;

-- Удаляем старые типы
DROP TYPE IF EXISTS meeting_status CASCADE;
DROP TYPE IF EXISTS agreement_status CASCADE;
DROP TYPE IF EXISTS agreement_type CASCADE;

-- Создаем упрощенные типы
CREATE TYPE meeting_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');

-- Полностью JSON таблица встреч
CREATE TABLE meetings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Статус и время
    status meeting_status DEFAULT 'scheduled' NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- ВСЁ В JSON
    content JSONB DEFAULT '{}'::jsonb, -- Заметки + договоренности всё в одном JSON
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT meetings_time_check CHECK (
        (started_at IS NULL OR ended_at IS NULL OR started_at <= ended_at) AND
        (status = 'completed' OR ended_at IS NULL) AND
        (status IN ('active', 'completed') OR started_at IS NULL)
    ),
    -- Ограничение на количество договоренностей (максимум 20)
    CONSTRAINT meetings_agreements_limit CHECK (
        CASE 
            WHEN content->'agreements' IS NOT NULL 
            THEN jsonb_array_length(content->'agreements') <= 20
            ELSE true
        END
    )
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_meetings_employee_id ON meetings(employee_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_started_at ON meetings(started_at);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at);
CREATE INDEX IF NOT EXISTS idx_meetings_employee_status ON meetings(employee_id, status);

-- Индекс для поиска по всему JSON контенту
CREATE INDEX IF NOT EXISTS idx_meetings_content_gin ON meetings USING GIN(content);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_meetings_updated_at 
    BEFORE UPDATE ON meetings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблице и столбцам
COMMENT ON TABLE meetings IS 'Полностью JSON таблица one-to-one встреч';
COMMENT ON COLUMN meetings.id IS 'Уникальный идентификатор встречи';
COMMENT ON COLUMN meetings.employee_id IS 'ID сотрудника, с которым проводится встреча';
COMMENT ON COLUMN meetings.status IS 'Статус встречи: scheduled, active, completed, cancelled';
COMMENT ON COLUMN meetings.started_at IS 'Дата и время начала встречи';
COMMENT ON COLUMN meetings.ended_at IS 'Дата и время завершения встречи';
COMMENT ON COLUMN meetings.content IS 'Весь контент встречи в JSON: заметки + договоренности';

-- Пример структуры данных в JSON:
/*
{
  "notes": "Длинная заметка о встрече с сотрудником...",
  "agreements": [
    {
      "id": "agreement-1",
      "title": "Подготовить отчет по проекту",
      "description": "Детальный отчет с метриками",
      "type": "employee_task",
      "created_at": "2024-01-15T10:50:00Z"
    },
    {
      "id": "agreement-2", 
      "title": "Организовать обучение команды",
      "description": "Найти тренера и забронировать время",
      "type": "manager_task",
      "created_at": "2024-01-15T10:55:00Z"
    }
  ]
}
*/
