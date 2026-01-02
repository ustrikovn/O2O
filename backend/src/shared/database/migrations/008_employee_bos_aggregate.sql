-- Миграция 008: Интегральные BOS-показатели сотрудников
-- Хранит агрегированные оценки по 12 BOS-поведениям с exponential decay

CREATE TABLE IF NOT EXISTS employee_bos_aggregate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Агрегированные оценки (12 поведений)
    -- Структура: { "behavior_key": score (число от 1 до 5 или null) }
    scores JSONB NOT NULL DEFAULT '{}',
    
    -- Количество встреч, использованных для расчёта (макс. 6)
    meetings_count INTEGER NOT NULL DEFAULT 0,
    
    -- Время последнего обновления агрегата
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по employee_id (уникальный constraint уже создаёт индекс)
CREATE INDEX IF NOT EXISTS idx_employee_bos_aggregate_updated 
    ON employee_bos_aggregate(updated_at DESC);

-- Комментарии
COMMENT ON TABLE employee_bos_aggregate IS 'Интегральные BOS-показатели сотрудников с exponential decay';
COMMENT ON COLUMN employee_bos_aggregate.scores IS 'Агрегированные оценки по 12 BOS-поведениям (1-5 или null)';
COMMENT ON COLUMN employee_bos_aggregate.meetings_count IS 'Количество встреч, использованных для расчёта (макс. 6)';
COMMENT ON COLUMN employee_bos_aggregate.updated_at IS 'Время последнего пересчёта агрегата';

/*
ФОРМУЛА EXPONENTIAL DECAY:
Веса по последним 6 встречам:
- Последняя встреча: 50%
- -1 встреча: 25%
- -2 встречи: 13%
- -3 встречи: 6%
- -4 встречи: 3%
- -5 встреч: 1.5%

Встречи старше 6 не учитываются.
Веса нормализуются если не все 6 встреч имеют оценку.

12 BOS-ПОВЕДЕНИЙ:
1. problem_articulation - Выражение проблем
2. interest_articulation - Выражение интересов
3. proactive_communication - Инициативная коммуникация
4. collaborative_behavior - Сотрудничество
5. feedback_receptivity - Восприимчивость к ОС
6. task_ownership - Ответственность за задачи
7. commitment_to_agreements - Соблюдение договорённостей
8. decision_quality - Качество решений
9. emotional_intelligence - Эмоциональный интеллект
10. goal_alignment - Согласованность целей
11. learning_agility - Готовность к обучению
12. strategic_thinking - Стратегическое мышление
*/


