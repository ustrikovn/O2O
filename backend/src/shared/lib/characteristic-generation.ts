/**
 * Сервис генерации характеристик сотрудников через LLM
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
import { MeetingEntity } from '@/entities/meeting/index.js';
import { EmployeeEntity } from '@/entities/employee/index.js';
import { 
  CharacteristicGenerationContext,
  GenerateCharacteristicResult,
  CharacteristicMetadata,
  DataRichnessLevel
} from '@/shared/types/characteristic.js';
import { query } from '@/shared/database/connection.js';

export class CharacteristicGenerationService {
  private textService: TextGenerationService;

  constructor() {
    this.textService = new TextGenerationService();
  }

  /**
   * Генерация характеристики для сотрудника
   */
  async generateCharacteristic(
    employeeId: string,
    previousCharacteristic?: string | null
  ): Promise<GenerateCharacteristicResult> {
    const startTime = Date.now();

    // 1. Собираем контекст о сотруднике
    const context = await this.gatherContext(employeeId, previousCharacteristic);

    // 2. Вычисляем показатель наполненности данных и отпечаток контекста
    const dataRichness = this.calculateDataRichness(context);
    const contextFingerprint = this.buildContextFingerprint(context);

    // 3. Если данных совсем нет, возвращаем заглушку
    if (dataRichness.score === 0) {
      return {
        content: 'Недостаточно данных для формирования характеристики. Проведите встречу или попросите сотрудника пройти опрос.',
        metadata: {
          sources: {
            meetings_count: 0,
            surveys_count: 0
          },
          data_richness_score: 0,
          generation_metadata: {
            model: 'none',
            generation_time_ms: Date.now() - startTime
          }
        }
      };
    }

    // 4. Формируем промпт для LLM
    const prompt = this.buildPrompt(context, dataRichness);

    // 5. Генерируем характеристику через LLM
    const llmResult = await this.textService.generateText({
      system: this.getSystemPrompt(),
      prompt,
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 1000
    });

    const content = llmResult.text.trim();

    // 6. Генерируем summary изменений (если есть предыдущая версия)
    let changesSummary: string | undefined;
    if (previousCharacteristic) {
      changesSummary = await this.generateChangesSummary(
        previousCharacteristic,
        content
      );
    }

    // 7. Формируем метаданные
    const metadata: CharacteristicMetadata = {
      sources: {
        meetings_count: context.meetings.length,
        surveys_count: context.surveys.length,
        last_meeting_date: context.meetings[0]?.started_at,
        last_survey_date: context.surveys[0]?.completed_at
      },
      data_richness_score: dataRichness.score,
      generation_metadata: {
        model: llmResult.model,
        generation_time_ms: Date.now() - startTime,
        context_fingerprint: contextFingerprint
      }
    };

    return {
      content,
      changes_summary: changesSummary,
      metadata
    };
  }

  /**
   * Публичный метод: собрать контекст, посчитать наполненность и отпечаток
   */
  async computeContextFingerprint(employeeId: string): Promise<{
    context: CharacteristicGenerationContext;
    dataRichness: DataRichnessLevel;
    fingerprint: string;
  }> {
    const context = await this.gatherContext(employeeId, undefined);
    const dataRichness = this.calculateDataRichness(context);
    const fingerprint = this.buildContextFingerprint(context);
    return { context, dataRichness, fingerprint };
  }

  /**
   * Сбор контекста о сотруднике для генерации
   */
  private async gatherContext(
    employeeId: string,
    previousCharacteristic?: string | null
  ): Promise<CharacteristicGenerationContext> {
    // Получаем данные о сотруднике
    const employee = await EmployeeEntity.findById(employeeId);
    if (!employee) {
      throw new Error(`Сотрудник с ID ${employeeId} не найден`);
    }

    // Получаем завершенные встречи
    const meetingsResult = await query(
      `SELECT * FROM meetings 
       WHERE employee_id = $1 AND status = 'completed'
       ORDER BY ended_at DESC NULLS LAST, started_at DESC NULLS LAST
       LIMIT 50`,
      [employeeId]
    );
    const meetings = meetingsResult.rows.map(row => ({
      id: row.id,
      status: row.status,
      started_at: row.started_at,
      ended_at: row.ended_at,
      content: row.content
    }));

    // Получаем завершенные опросы с результатами
    const surveysResult = await query(
      `SELECT 
        sr.id,
        sr.survey_id,
        sr.status,
        sr.answers,
        sr.completed_at,
        sr.metadata,
        s.title,
        s.description
       FROM survey_results sr
       JOIN surveys s ON sr.survey_id = s.id
       WHERE sr.employee_id = $1 AND sr.status = 'completed'
       ORDER BY sr.completed_at DESC
       LIMIT 20`,
      [employeeId]
    );
    const surveys = surveysResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      answers: row.answers,
      completed_at: row.completed_at,
      metadata: row.metadata
    }));

    return {
      employee: {
        id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        position: employee.position,
        team: employee.team
      },
      meetings,
      surveys,
      previous_characteristic: previousCharacteristic
    };
  }

  /**
   * Вычисление показателя наполненности данных
   */
  private calculateDataRichness(context: CharacteristicGenerationContext): DataRichnessLevel {
    const meetingsCount = context.meetings.length;
    const surveysCount = context.surveys.length;

    // Подсчет общего количества "ценных" данных
    let score = 0;

    // Встречи дают больше баллов, если есть заметки и договоренности
    context.meetings.forEach(meeting => {
      const hasNotes = meeting.content?.notes && meeting.content.notes.length > 50;
      const agreementsCount = meeting.content?.agreements?.length || 0;

      if (hasNotes && agreementsCount > 0) {
        score += 15; // Полноценная встреча
      } else if (hasNotes || agreementsCount > 0) {
        score += 8; // Частично заполненная встреча
      } else {
        score += 3; // Встреча без контента
      }
    });

    // Опросы дают баллы
    context.surveys.forEach(survey => {
      const hasInterpretation = survey.metadata?.disc?.llmDescription || survey.metadata?.bigFive?.llmDescription;
      const answersCount = survey.answers?.length || 0;

      if (hasInterpretation && answersCount > 5) {
        score += 20; // Полный опрос с интерпретацией
      } else if (answersCount > 3) {
        score += 10; // Опрос без интерпретации
      } else {
        score += 5; // Минимальный опрос
      }
    });

    // Нормализуем до 100
    score = Math.min(score, 100);

    // Определяем уровень
    let level: DataRichnessLevel['level'];
    let description: string;

    if (score === 0) {
      level = 'none';
      description = 'Нет данных для характеристики';
    } else if (score < 20) {
      level = 'minimal';
      description = 'Минимальные данные, требуется больше встреч и опросов';
    } else if (score < 40) {
      level = 'moderate';
      description = 'Умеренная наполненность, характеристика будет базовой';
    } else if (score < 70) {
      level = 'good';
      description = 'Хорошая наполненность данных';
    } else {
      level = 'excellent';
      description = 'Отличная наполненность, характеристика будет детальной';
    }

    return { level, score, description };
  }

  /**
   * Системный промпт для LLM
   */
  private getSystemPrompt(): string {
    return `Ты - AI-ассистент руководителя в системе управления one-to-one встречами. Твоя роль - быть аналитиком и советником, который помогает руководителю лучше понимать своих сотрудников.

## Контекст твоей работы:
Руководитель регулярно проводит встречи с сотрудниками, фиксирует обратную связь, наблюдения, договоренности. Сотрудники проходят психометрические опросы (DISC, Big Five). Вся эта информация накапливается, и руководителю нужна твоя помощь, чтобы синтезировать разрозненные данные в целостное понимание человека.

## От чьего лица ты пишешь:
Ты пишешь как объективный аналитик, который смотрит на данные со стороны. НЕ пиши от первого лица ("я думаю", "мне кажется"). НЕ обращайся напрямую к руководителю ("вам следует"). Пиши описательно и аналитически, как если бы ты составлял профессиональную характеристику для HR-досье.

## Цель характеристики:
Помочь руководителю:
- Быстро вспомнить ключевое о сотруднике перед встречей
- Понять текущее состояние человека (настроение, мотивация, проблемы)
- Увидеть паттерны и динамику изменений
- Получить подсказки, как лучше взаимодействовать с этим конкретным человеком

## Формат и стиль:
- **Структура:** 2-3 связных абзаца (НЕ списки, НЕ bullet points)
- **Объем:** 200-250 слов (кратко и по сути)
- **Тон:** профессиональный, уважительный, эмпатичный, но деловой
- **Язык:** русский, избегай канцелярщины и HR-жаргона
- **Опирайся ТОЛЬКО на факты** из предоставленных данных, не додумывай
- **БАЛАНС:** Используй данные из встреч И из опросов РАВНОМЕРНО. Опросы показывают тип личности, встречи - текущее состояние. Оба источника одинаково важны

## Приоритет недавних изменений:
- Делай упор на события последних 60 дней: изменения настроения, мотивации, запросов и договоренностей
- Старые данные используй как фон (контекст), но не как главный тезис
- Если новых событий нет, подчеркни стабильность и неизменность ключевых паттернов

## Что обязательно включить:
1. **Профиль личности** (из опросов): характер, стиль работы, сильные стороны
2. **Текущее состояние** (из встреч): настроение, запросы, проблемы
3. **Динамика** (если есть): как меняется со временем

## Что НЕ включать или минимизировать:
- Общие фразы без конкретики
- Повторение одного и того же разными словами
- Избыточную детализацию - будь конкретен, но краток

## Что НЕ делать:
- НЕ используй шаблонные фразы ("является ценным сотрудником", "показывает высокие результаты")
- НЕ пиши оценочные суждения без опоры на факты
- НЕ используй маркированные списки
- НЕ пиши слишком формально или сухо - пиши так, чтобы за текстом чувствовался живой человек

Помни: твоя задача - дать руководителю глубокое, практичное понимание сотрудника как человека, а не просто перечислить факты.`;
  }

  /**
   * Построение промпта для генерации характеристики
   */
  private buildPrompt(
    context: CharacteristicGenerationContext,
    dataRichness: DataRichnessLevel
  ): string {
    const { employee, meetings, surveys, previous_characteristic } = context;

    let prompt = `Создай характеристику для сотрудника:

**Информация о сотруднике:**
- ФИО: ${employee.first_name} ${employee.last_name}
- Должность: ${employee.position}
- Команда: ${employee.team}

**Уровень наполненности данных:** ${dataRichness.description}

`;

    // Добавляем информацию о встречах
    if (meetings.length > 0) {
      const recentMeetings = meetings.slice(0, 10);
      prompt += `**Проведено встреч:** ${meetings.length}\n\n`;
      prompt += `**Информация из встреч (последние встречи):**\n`;

      recentMeetings.forEach((meeting, idx) => {
        const date = meeting.ended_at || meeting.started_at;
        const dateStr = date ? new Date(date).toLocaleDateString('ru-RU') : 'Дата неизвестна';
        
        prompt += `\nВстреча ${idx + 1} (${dateStr}):\n`;

        if (meeting.content?.notes) {
          prompt += `Заметки: ${meeting.content.notes}\n`;
        }

        if (meeting.content?.agreements && meeting.content.agreements.length > 0) {
          prompt += `Договоренности:\n`;
          meeting.content.agreements.slice(0, 5).forEach((agreement: any) => {
            prompt += `- ${agreement.title}\n`;
          });
        }
      });
    }

    // Добавляем информацию из опросов
    if (surveys.length > 0) {
      const recentSurveys = surveys.slice(0, 5);
      prompt += `\n\n**Пройдено опросов:** ${surveys.length}\n\n`;
      prompt += `**Результаты опросов:**\n`;

      recentSurveys.forEach((survey, idx) => {
        prompt += `\nОпрос ${idx + 1}: ${survey.title}\n`;

        // DISC профиль
        if (survey.metadata?.disc?.llmDescription) {
          prompt += `DISC профиль: ${survey.metadata.disc.llmDescription}\n`;
        } else if (survey.metadata?.disc?.profileHint) {
          prompt += `DISC: ${survey.metadata.disc.profileHint}\n`;
        }

        // Big Five
        if (survey.metadata?.bigFive?.llmDescription) {
          prompt += `Big Five: ${survey.metadata.bigFive.llmDescription}\n`;
        }
      });
    }

    // Добавляем предыдущую характеристику для контекста и акцента на динамику
    if (previous_characteristic) {
      prompt += `\n\n**Предыдущая характеристика (для понимания динамики):**\n${previous_characteristic}\n`;
      prompt += `\nСконцентрируйся на том, что изменилось недавно (если изменилось): настроение, мотивация, запросы, договоренности. Если изменений нет — отрази устойчивость и стабильность.\n`;
    }

    prompt += `\n\nТеперь создай новую сбалансированную интегральную характеристику этого сотрудника.

ВАЖНО:
- Объем: 200-250 слов (2-3 абзаца)
- Используй РАВНОМЕРНО данные из опросов (тип личности) и из встреч (текущее состояние)
- Синтезируй информацию в целостный портрет человека`;

    return prompt;
  }

  /**
   * Сборка отпечатка контекста (для детекции изменений)
   */
  private buildContextFingerprint(context: CharacteristicGenerationContext): string {
    const position = context.employee.position || '';
    const meetingsCount = context.meetings.length;
    const surveysCount = context.surveys.length;
    const lastMeeting = context.meetings[0]?.ended_at || context.meetings[0]?.started_at || '';
    const lastSurvey = context.surveys[0]?.completed_at || '';
    return [position, String(meetingsCount), String(surveysCount), String(lastMeeting), String(lastSurvey)].join('|');
  }

  /**
   * Генерация краткого описания изменений
   */
  private async generateChangesSummary(
    previousContent: string,
    newContent: string
  ): Promise<string> {
    const prompt = `Сравни две версии характеристики сотрудника и кратко опиши ключевые изменения (2-3 предложения).

**Предыдущая версия:**
${previousContent}

**Новая версия:**
${newContent}

Опиши только значимые изменения в настроении, мотивации, проблемах или развитии сотрудника.`;

    const result = await this.textService.generateText({
      system: 'Ты - аналитик, который выявляет ключевые изменения в характеристиках сотрудников.',
      prompt,
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 300
    });

    return result.text.trim();
  }
}

