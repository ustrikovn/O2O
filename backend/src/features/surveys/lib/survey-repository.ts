/**
 * Репозиторий для работы с опросами в базе данных
 */

import { Pool } from 'pg';
import { 
  Survey, 
  SurveyResult, 
  SurveyStats,
  QuestionAnswer
} from '../../../shared/types/survey.js';

export class SurveyRepository {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Создать новый опрос
   */
  async create(survey: Survey): Promise<Survey> {
    const query = `
      INSERT INTO surveys (
        id, title, description, questions, logic, scoring, settings,
        metadata, version, category, estimated_duration, author, tags, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      survey.id,
      survey.title,
      survey.description,
      JSON.stringify(survey.questions),
      JSON.stringify(survey.logic),
      survey.scoring ? JSON.stringify(survey.scoring) : null,
      survey.settings ? JSON.stringify(survey.settings) : null,
      survey.metadata ? JSON.stringify(survey.metadata) : null,
      survey.metadata?.version || '1.0.0',
      survey.metadata?.category,
      survey.metadata?.estimatedDuration,
      survey.metadata?.author,
      survey.metadata?.tags,
      survey.isActive
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToSurvey(result.rows[0]);
  }

  /**
   * Найти опрос по ID
   */
  async findById(id: string): Promise<Survey | null> {
    const query = 'SELECT * FROM surveys WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSurvey(result.rows[0]);
  }

  /**
   * Найти активные опросы
   */
  async findActive(category?: string): Promise<Survey[]> {
    let query = 'SELECT * FROM surveys WHERE is_active = true';
    const values: any[] = [];

    if (category) {
      query += ' AND category = $1';
      values.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToSurvey(row));
  }

  /**
   * Обновить опрос
   */
  async update(id: string, updates: Partial<Survey>): Promise<Survey> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.questions !== undefined) {
      setClauses.push(`questions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.questions));
    }

    if (updates.logic !== undefined) {
      setClauses.push(`logic = $${paramIndex++}`);
      values.push(JSON.stringify(updates.logic));
    }

    if (updates.scoring !== undefined) {
      setClauses.push(`scoring = $${paramIndex++}`);
      values.push(updates.scoring ? JSON.stringify(updates.scoring) : null);
    }

    if (updates.settings !== undefined) {
      setClauses.push(`settings = $${paramIndex++}`);
      values.push(updates.settings ? JSON.stringify(updates.settings) : null);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));

      if (updates.metadata.category !== undefined) {
        setClauses.push(`category = $${paramIndex++}`);
        values.push(updates.metadata.category);
      }

      if (updates.metadata.estimatedDuration !== undefined) {
        setClauses.push(`estimated_duration = $${paramIndex++}`);
        values.push(updates.metadata.estimatedDuration);
      }

      if (updates.metadata.author !== undefined) {
        setClauses.push(`author = $${paramIndex++}`);
        values.push(updates.metadata.author);
      }

      if (updates.metadata.tags !== undefined) {
        setClauses.push(`tags = $${paramIndex++}`);
        values.push(updates.metadata.tags);
      }

      if (updates.metadata.version !== undefined) {
        setClauses.push(`version = $${paramIndex++}`);
        values.push(updates.metadata.version);
      }
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE surveys 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);
    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Survey not found');
    }

    return this.mapRowToSurvey(result.rows[0]);
  }

  /**
   * Удалить опрос
   */
  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM surveys WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Создать результат опроса
   */
  async createResult(result: SurveyResult): Promise<SurveyResult> {
    const query = `
      INSERT INTO survey_results (
        id, survey_id, employee_id, meeting_id, answers, status, started_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      result.id,
      result.surveyId,
      result.employeeId || null,
      result.meetingId || null,
      JSON.stringify(result.answers),
      result.status,
      result.startedAt,
      result.metadata ? JSON.stringify(result.metadata) : null
    ];

    const dbResult = await this.db.query(query, values);
    return this.mapRowToSurveyResult(dbResult.rows[0]);
  }

  /**
   * Найти результат по ID
   */
  async findResultById(id: string): Promise<SurveyResult | null> {
    const query = 'SELECT * FROM survey_results WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSurveyResult(result.rows[0]);
  }

  /**
   * Обновить результат опроса
   */
  async updateResult(id: string, updates: Partial<SurveyResult>): Promise<SurveyResult> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.answers !== undefined) {
      setClauses.push(`answers = $${paramIndex++}`);
      values.push(JSON.stringify(updates.answers));
    }

    if (updates.profile !== undefined) {
      setClauses.push(`profile = $${paramIndex++}`);
      values.push(updates.profile);
    }

    if (updates.score !== undefined) {
      setClauses.push(`score = $${paramIndex++}`);
      values.push(updates.score);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (updates.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    setClauses.push(`last_activity_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE survey_results 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);
    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Survey result not found');
    }

    return this.mapRowToSurveyResult(result.rows[0]);
  }

  /**
   * Найти результаты опросов для сотрудника
   */
  async findResultsByEmployee(employeeId: string, surveyId?: string): Promise<SurveyResult[]> {
    let query = 'SELECT * FROM survey_results WHERE employee_id = $1';
    const values: any[] = [employeeId];

    if (surveyId) {
      query += ' AND survey_id = $2';
      values.push(surveyId);
    }

    query += ' ORDER BY started_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToSurveyResult(row));
  }

  /**
   * Найти результаты опросов для встречи
   */
  async findResultsByMeeting(meetingId: string): Promise<SurveyResult[]> {
    const query = 'SELECT * FROM survey_results WHERE meeting_id = $1 ORDER BY started_at DESC';
    const result = await this.db.query(query, [meetingId]);
    return result.rows.map(row => this.mapRowToSurveyResult(row));
  }

  /**
   * Найти результаты по опросу
   */
  async findResultsBySurvey(
    surveyId: string, 
    status?: SurveyResult['status'],
    limit?: number,
    offset?: number
  ): Promise<{ results: SurveyResult[]; total: number }> {
    let whereClause = 'WHERE survey_id = $1';
    const values: any[] = [surveyId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    // Получаем общее количество
    const countQuery = `SELECT COUNT(*) as total FROM survey_results ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Получаем результаты с пагинацией
    let dataQuery = `SELECT * FROM survey_results ${whereClause} ORDER BY started_at DESC`;
    
    if (limit) {
      dataQuery += ` LIMIT $${paramIndex++}`;
      values.push(limit);
    }

    if (offset) {
      dataQuery += ` OFFSET $${paramIndex++}`;
      values.push(offset);
    }

    const dataResult = await this.db.query(dataQuery, values);
    const results = dataResult.rows.map(row => this.mapRowToSurveyResult(row));

    return { results, total };
  }

  /**
   * Получить статистику по опросу
   */
  async getStatistics(surveyId: string): Promise<SurveyStats> {
    // Основная статистика
    const mainStatsQuery = `
      SELECT 
        COUNT(*) as total_responses,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_responses,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_responses,
        AVG(
          CASE 
            WHEN status = 'completed' AND completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60 
          END
        ) as average_duration
      FROM survey_results 
      WHERE survey_id = $1
    `;

    const mainStatsResult = await this.db.query(mainStatsQuery, [surveyId]);
    const mainStats = mainStatsResult.rows[0];

    // Распределение профилей
    const profileStatsQuery = `
      SELECT profile, COUNT(*) as count
      FROM survey_results 
      WHERE survey_id = $1 AND profile IS NOT NULL AND status = 'completed'
      GROUP BY profile
    `;

    const profileStatsResult = await this.db.query(profileStatsQuery, [surveyId]);
    const profileDistribution: Record<string, number> = {};
    
    for (const row of profileStatsResult.rows) {
      profileDistribution[row.profile] = parseInt(row.count);
    }

    // Получаем опрос для анализа вопросов
    const survey = await this.findById(surveyId);
    const questionStats: SurveyStats['questionStats'] = [];

    if (survey) {
      for (const question of survey.questions) {
        const questionStatsQuery = `
          SELECT 
            COUNT(*) as response_count,
            answers
          FROM survey_results 
          WHERE survey_id = $1 AND status = 'completed'
          AND answers::jsonb @> $2
        `;

        const questionFilter = JSON.stringify([{ questionId: question.id }]);
        const questionResult = await this.db.query(questionStatsQuery, [surveyId, questionFilter]);
        
        let responseCount = 0;
        const valueDistribution: Record<string, number> = {};

        // Анализируем ответы на конкретный вопрос
        const allAnswersQuery = `
          SELECT answers 
          FROM survey_results 
          WHERE survey_id = $1 AND status = 'completed'
        `;
        
        const allAnswersResult = await this.db.query(allAnswersQuery, [surveyId]);
        
        for (const row of allAnswersResult.rows) {
          const answers: QuestionAnswer[] = row.answers;
          const questionAnswer = answers.find(a => a.questionId === question.id);
          
          if (questionAnswer) {
            responseCount++;
            
            // Подсчитываем распределение значений
            let valueKey: string;
            if (Array.isArray(questionAnswer.value)) {
              valueKey = questionAnswer.value.join(', ');
            } else {
              valueKey = String(questionAnswer.value);
            }
            
            valueDistribution[valueKey] = (valueDistribution[valueKey] || 0) + 1;
          }
        }

        questionStats.push({
          questionId: question.id,
          responseCount,
          valueDistribution
        });
      }
    }

    return {
      surveyId,
      totalResponses: parseInt(mainStats.total_responses),
      completedResponses: parseInt(mainStats.completed_responses),
      abandonedResponses: parseInt(mainStats.abandoned_responses),
      averageDuration: mainStats.average_duration ? parseFloat(mainStats.average_duration) : undefined,
      profileDistribution,
      questionStats
    };
  }

  /**
   * Найти заброшенные результаты
   */
  async findAbandonedResults(olderThanHours: number): Promise<SurveyResult[]> {
    const query = `
      SELECT * FROM survey_results 
      WHERE status IN ('started', 'in_progress') 
      AND last_activity_at < NOW() - INTERVAL '${olderThanHours} hours'
      ORDER BY last_activity_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRowToSurveyResult(row));
  }

  /**
   * Маппинг строки БД в объект Survey
   */
  private mapRowToSurvey(row: any): Survey {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      questions: row.questions,
      logic: row.logic,
      scoring: row.scoring,
      settings: row.settings,
      metadata: {
        ...row.metadata,
        category: row.category,
        estimatedDuration: row.estimated_duration,
        author: row.author,
        tags: row.tags,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      isActive: row.is_active
    };
  }

  /**
   * Маппинг строки БД в объект SurveyResult
   */
  private mapRowToSurveyResult(row: any): SurveyResult {
    return {
      id: row.id,
      surveyId: row.survey_id,
      employeeId: row.employee_id || undefined,
      meetingId: row.meeting_id || undefined,
      answers: row.answers || [],
      profile: row.profile || undefined,
      score: row.score ? parseFloat(row.score) : undefined,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      metadata: row.metadata || undefined
    };
  }
}
