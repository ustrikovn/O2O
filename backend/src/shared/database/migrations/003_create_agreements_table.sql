-- Создание таблицы договоренностей
-- Отделяем договоренности от JSON content встреч для лучшей архитектуры

CREATE TABLE IF NOT EXISTS agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    responsible_type VARCHAR(20) NOT NULL CHECK (responsible_type IN ('employee_task', 'manager_task')),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'marked_for_completion', 'completed')),
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_completed_at CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR 
        (status != 'completed' AND completed_at IS NULL)
    )
);

-- Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_agreements_employee_status ON agreements(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_agreements_meeting_id ON agreements(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agreements_due_date ON agreements(due_date);
CREATE INDEX IF NOT EXISTS idx_agreements_created_at ON agreements(created_at);

-- Комментарии для документации
COMMENT ON TABLE agreements IS 'Договоренности из One-to-One встреч';
COMMENT ON COLUMN agreements.id IS 'Уникальный идентификатор договоренности';
COMMENT ON COLUMN agreements.meeting_id IS 'ID встречи, на которой создана договоренность';
COMMENT ON COLUMN agreements.employee_id IS 'ID сотрудника, с которым проводилась встреча';
COMMENT ON COLUMN agreements.title IS 'Краткое описание договоренности';
COMMENT ON COLUMN agreements.description IS 'Подробное описание (необязательно)';
COMMENT ON COLUMN agreements.responsible_type IS 'Кто ответственен: employee_task или manager_task';
COMMENT ON COLUMN agreements.status IS 'Статус: pending -> marked_for_completion -> completed';
COMMENT ON COLUMN agreements.due_date IS 'Планируемая дата выполнения';
COMMENT ON COLUMN agreements.created_at IS 'Дата и время создания';
COMMENT ON COLUMN agreements.completed_at IS 'Дата и время фактического выполнения';
