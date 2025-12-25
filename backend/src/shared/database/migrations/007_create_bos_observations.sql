-- Миграция для создания таблицы BOS-наблюдений
-- Behavioral Observation Scale - структурированное наблюдение поведения сотрудников
-- Версия: 1.0.0

-- Таблица BOS-наблюдений для встреч
CREATE TABLE IF NOT EXISTS meeting_bos_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Статус обработки
    status VARCHAR(20) DEFAULT 'pending' NOT NULL 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,  -- сообщение об ошибке если status = 'failed'
    
    -- 12 BOS оценок (1-5 или null если не наблюдалось)
    -- Структура: { "behavior_key": { "score": 1-5|null, "evidence": "цитата"|null } }
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Метаданные генерации
    metadata JSONB DEFAULT '{}'::jsonb,
    /*
    Структура metadata:
    {
      "model": "claude-sonnet-4-20250514",
      "tokens_used": 1500,
      "generation_time_ms": 3500,
      "input_data": {
        "notes_length": 500,
        "agreements_count": 3
      }
    }
    */
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Ограничения
    CONSTRAINT unique_meeting_bos UNIQUE (meeting_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_bos_observations_meeting_id ON meeting_bos_observations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_bos_observations_employee_id ON meeting_bos_observations(employee_id);
CREATE INDEX IF NOT EXISTS idx_bos_observations_status ON meeting_bos_observations(status);
CREATE INDEX IF NOT EXISTS idx_bos_observations_created_at ON meeting_bos_observations(created_at);

-- GIN индекс для поиска по JSON scores
CREATE INDEX IF NOT EXISTS idx_bos_observations_scores_gin ON meeting_bos_observations USING GIN(scores);

-- Триггер для автоматического обновления (используем существующую функцию)
-- Примечание: функция update_updated_at_column уже существует в schema.sql

-- Комментарии к таблице и столбцам
COMMENT ON TABLE meeting_bos_observations IS 'BOS-наблюдения поведения сотрудников на one-to-one встречах';
COMMENT ON COLUMN meeting_bos_observations.id IS 'Уникальный идентификатор наблюдения';
COMMENT ON COLUMN meeting_bos_observations.meeting_id IS 'ID встречи (уникальная связь)';
COMMENT ON COLUMN meeting_bos_observations.employee_id IS 'ID сотрудника для быстрой фильтрации';
COMMENT ON COLUMN meeting_bos_observations.status IS 'Статус обработки: pending, processing, completed, failed';
COMMENT ON COLUMN meeting_bos_observations.error_message IS 'Сообщение об ошибке если анализ не удался';
COMMENT ON COLUMN meeting_bos_observations.scores IS 'JSON с оценками по 12 BOS-шкалам и цитатами-доказательствами';
COMMENT ON COLUMN meeting_bos_observations.metadata IS 'Метаданные генерации: модель, токены, время';
COMMENT ON COLUMN meeting_bos_observations.created_at IS 'Дата создания записи (начало анализа)';
COMMENT ON COLUMN meeting_bos_observations.completed_at IS 'Дата завершения анализа';

/*
═══════════════════════════════════════════════════════════════
12 BOS ПОВЕДЕНИЙ (ключи для scores):
═══════════════════════════════════════════════════════════════

1. problem_articulation      - Выражение проблем
2. interest_articulation     - Выражение интересов  
3. proactive_communication   - Инициативная коммуникация
4. collaborative_behavior    - Сотрудничество
5. feedback_receptivity      - Восприимчивость к обратной связи
6. task_ownership            - Ответственность за задачи
7. goal_alignment            - Согласованность целей
8. learning_agility          - Готовность к обучению
9. decision_quality          - Качество решений
10. emotional_intelligence   - Эмоциональный интеллект
11. commitment_to_agreements - Соблюдение договорённостей
12. strategic_thinking       - Стратегическое мышление

Шкала оценки: 1-5 или NULL (не наблюдалось)
*/
