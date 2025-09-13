-- Миграция для создания схемы системы one-to-one встреч
-- Версия: 2.0.0

-- Расширения PostgreSQL (если еще не созданы)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Перечисления для статусов
CREATE TYPE meeting_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
CREATE TYPE agreement_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE agreement_type AS ENUM ('employee_task', 'manager_task', 'mutual_agreement');

-- Таблица встреч one-to-one
CREATE TABLE IF NOT EXISTS meetings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status meeting_status DEFAULT 'scheduled' NOT NULL,
    
    -- Время встречи
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    
    -- Мета-информация
    title VARCHAR(200),
    location VARCHAR(200),
    
    -- Общие заметки о встрече
    summary TEXT,
    
    -- Оценка удовлетворенности (1-10)
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 10),
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT meetings_time_check CHECK (
        (started_at IS NULL OR ended_at IS NULL OR started_at <= ended_at) AND
        (status = 'completed' OR ended_at IS NULL) AND
        (status IN ('active', 'completed') OR started_at IS NULL)
    )
);

-- Таблица заметок для встреч
CREATE TABLE IF NOT EXISTS meeting_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    
    -- Содержание заметки
    content TEXT NOT NULL,
    note_type VARCHAR(50) DEFAULT 'general' NOT NULL, -- general, feedback, observation, concern
    
    -- Категоризация для ИИ-анализа
    tags TEXT[], -- Массив тегов для группировки и поиска
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT meeting_notes_content_check CHECK (LENGTH(content) > 0)
);

-- Таблица договоренностей (задач и соглашений)
CREATE TABLE IF NOT EXISTS meeting_agreements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    
    -- Содержание договоренности
    title VARCHAR(200) NOT NULL,
    description TEXT,
    agreement_type agreement_type NOT NULL,
    status agreement_status DEFAULT 'pending' NOT NULL,
    
    -- Приоритет и сроки
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5), -- 1 = высокий, 5 = низкий
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Связь с предыдущими договоренностями
    parent_agreement_id UUID REFERENCES meeting_agreements(id),
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT meeting_agreements_title_check CHECK (LENGTH(title) > 0),
    CONSTRAINT meeting_agreements_completed_check CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR 
        (status != 'completed' AND completed_at IS NULL)
    )
);

-- Индексы для оптимизации запросов

-- Встречи
CREATE INDEX IF NOT EXISTS idx_meetings_employee_id ON meetings(employee_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_started_at ON meetings(started_at);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at);
CREATE INDEX IF NOT EXISTS idx_meetings_employee_status ON meetings(employee_id, status);

-- Заметки
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting_id ON meeting_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_type ON meeting_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_tags ON meeting_notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_created_at ON meeting_notes(created_at);

-- Договоренности
CREATE INDEX IF NOT EXISTS idx_meeting_agreements_meeting_id ON meeting_agreements(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agreements_status ON meeting_agreements(status);
CREATE INDEX IF NOT EXISTS idx_meeting_agreements_type ON meeting_agreements(agreement_type);
CREATE INDEX IF NOT EXISTS idx_meeting_agreements_due_date ON meeting_agreements(due_date);
CREATE INDEX IF NOT EXISTS idx_meeting_agreements_parent ON meeting_agreements(parent_agreement_id);

-- Триггеры для автоматического обновления updated_at

-- Встречи
CREATE TRIGGER update_meetings_updated_at 
    BEFORE UPDATE ON meetings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Заметки
CREATE TRIGGER update_meeting_notes_updated_at 
    BEFORE UPDATE ON meeting_notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Договоренности
CREATE TRIGGER update_meeting_agreements_updated_at 
    BEFORE UPDATE ON meeting_agreements 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблицам и столбцам

-- Встречи
COMMENT ON TABLE meetings IS 'Таблица one-to-one встреч с сотрудниками';
COMMENT ON COLUMN meetings.id IS 'Уникальный идентификатор встречи';
COMMENT ON COLUMN meetings.employee_id IS 'ID сотрудника, с которым проводится встреча';
COMMENT ON COLUMN meetings.status IS 'Статус встречи: scheduled, active, completed, cancelled';
COMMENT ON COLUMN meetings.started_at IS 'Дата и время начала встречи';
COMMENT ON COLUMN meetings.ended_at IS 'Дата и время завершения встречи';
COMMENT ON COLUMN meetings.scheduled_at IS 'Запланированная дата и время встречи';
COMMENT ON COLUMN meetings.title IS 'Название/тема встречи';
COMMENT ON COLUMN meetings.location IS 'Место проведения встречи';
COMMENT ON COLUMN meetings.summary IS 'Общее резюме встречи';
COMMENT ON COLUMN meetings.satisfaction_rating IS 'Оценка удовлетворенности от 1 до 10';

-- Заметки
COMMENT ON TABLE meeting_notes IS 'Заметки, сделанные во время встреч';
COMMENT ON COLUMN meeting_notes.id IS 'Уникальный идентификатор заметки';
COMMENT ON COLUMN meeting_notes.meeting_id IS 'ID встречи, к которой относится заметка';
COMMENT ON COLUMN meeting_notes.content IS 'Содержание заметки';
COMMENT ON COLUMN meeting_notes.note_type IS 'Тип заметки: general, feedback, observation, concern';
COMMENT ON COLUMN meeting_notes.tags IS 'Массив тегов для категоризации и поиска';

-- Договоренности
COMMENT ON TABLE meeting_agreements IS 'Договоренности и задачи, возникшие в результате встреч';
COMMENT ON COLUMN meeting_agreements.id IS 'Уникальный идентификатор договоренности';
COMMENT ON COLUMN meeting_agreements.meeting_id IS 'ID встречи, на которой была достигнута договоренность';
COMMENT ON COLUMN meeting_agreements.title IS 'Краткое описание договоренности';
COMMENT ON COLUMN meeting_agreements.description IS 'Подробное описание договоренности';
COMMENT ON COLUMN meeting_agreements.agreement_type IS 'Тип: employee_task, manager_task, mutual_agreement';
COMMENT ON COLUMN meeting_agreements.status IS 'Статус выполнения: pending, in_progress, completed, cancelled';
COMMENT ON COLUMN meeting_agreements.priority IS 'Приоритет от 1 (высокий) до 5 (низкий)';
COMMENT ON COLUMN meeting_agreements.due_date IS 'Срок выполнения';
COMMENT ON COLUMN meeting_agreements.completed_at IS 'Дата и время завершения';
COMMENT ON COLUMN meeting_agreements.parent_agreement_id IS 'Связь с родительской договоренностью';
