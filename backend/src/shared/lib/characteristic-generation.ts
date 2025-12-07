/**
 * Сервис генерации характеристик сотрудников через LLM
 */

import { TextGenerationService } from '@/shared/llm/textService.js';
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
    previousCharacteristic?: string | null,
    options?: { excludeBigFive?: boolean }
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
        content: 'Недостаточно данных для формирования характеристики. Попросите сотрудника пройти опросы DISC и/или Big Five.',
        metadata: {
          sources: {
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
    const excludeBigFiveAuto = !this.contextHasBigFiveData(context);
    const excludeBigFiveFinal = options?.excludeBigFive === true || excludeBigFiveAuto;
    const prompt = this.buildPrompt(context, dataRichness, excludeBigFiveFinal);

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
        surveys_count: context.surveys.length,
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
   * Характеристика строится только на основе опросов DISC и BigFive
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

    // Получаем завершенные опросы с результатами (DISC, BigFive)
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
      surveys,
      previous_characteristic: previousCharacteristic
    };
  }

  /**
   * Вычисление показателя наполненности данных
   * Учитываются только результаты опросов DISC и BigFive
   */
  private calculateDataRichness(context: CharacteristicGenerationContext): DataRichnessLevel {
    const surveysCount = context.surveys.length;

    // Подсчет баллов только за опросы
    let score = 0;

    // Опросы дают баллы в зависимости от наличия интерпретации
    context.surveys.forEach(survey => {
      const hasDiscInterpretation = survey.metadata?.disc?.llmDescription || survey.metadata?.disc?.profileHint;
      const hasBigFiveInterpretation = survey.metadata?.bigFive?.llmDescription;
      const answersCount = survey.answers?.length || 0;

      if ((hasDiscInterpretation || hasBigFiveInterpretation) && answersCount > 5) {
        score += 50; // Полный опрос с интерпретацией (DISC или BigFive)
      } else if (answersCount > 3) {
        score += 25; // Опрос без интерпретации
      } else {
        score += 10; // Минимальный опрос
      }
    });

    // Нормализуем до 100
    score = Math.min(score, 100);

    // Определяем уровень (пороги пересмотрены для работы только с опросами)
    let level: DataRichnessLevel['level'];
    let description: string;

    if (score === 0) {
      level = 'none';
      description = 'Нет данных для характеристики';
    } else if (score < 25) {
      level = 'minimal';
      description = 'Минимальные данные, рекомендуется пройти дополнительные опросы';
    } else if (score < 50) {
      level = 'moderate';
      description = 'Умеренная наполненность, характеристика будет базовой';
    } else if (score < 80) {
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
    return `Ты - AI-ассистент руководителя в системе управления one-to-one встречами. Твоя роль - быть аналитиком и советником, который помогает руководителю лучше понимать своих сотрудников на основе психометрических профилей.

## Контекст твоей работы:
Сотрудники проходят психометрические опросы DISC и Big Five. Эти опросы дают глубокое понимание типа личности, мотивации, стиля работы и коммуникации человека. Используй строго только те опросы, которые присутствуют в переданных данных; если какого‑то опроса нет (например, Big Five), не упоминай его в тексте.

## От чьего лица ты пишешь:
Ты пишешь как объективный аналитик, который смотрит на данные со стороны. НЕ пиши от первого лица ("я думаю", "мне кажется"). НЕ обращайся напрямую к руководителю ("вам следует"). Пиши описательно и аналитически, как если бы ты составлял профессиональную характеристику для HR-досье.

## Цель характеристики:
Помочь руководителю:
- Быстро вспомнить ключевое о сотруднике перед встречей
- Понять тип личности и особенности коммуникации
- Увидеть сильные стороны и потенциальные зоны роста
- Получить подсказки, как лучше взаимодействовать с этим конкретным человеком

## Формат и стиль:
- **Структура:** 2-3 связных абзаца (НЕ списки, НЕ bullet points)
- **Объем:** 200-250 слов (кратко и по сути)
- **Тон:** профессиональный, уважительный, эмпатичный, но деловой
- **Язык:** русский, избегай канцелярщины и HR-жаргона
- **Опирайся ТОЛЬКО на факты** из предоставленных данных, не додумывай

## Что обязательно включить:
1. **Тип личности и поведенческий профиль** (из DISC): доминирующий стиль поведения, как проявляется в работе
2. **Личностные черты** (из Big Five, если есть): ключевые особенности характера
3. **Рекомендации по взаимодействию**: как лучше строить коммуникацию с этим человеком

## Что НЕ включать или минимизировать:
- Общие фразы без конкретики
- Повторение одного и того же разными словами
- Избыточную детализацию - будь конкретен, но краток

## Что НЕ делать:
- НЕ используй шаблонные фразы ("является ценным сотрудником", "показывает высокие результаты")
- НЕ пиши оценочные суждения без опоры на факты
- НЕ используй маркированные списки
- НЕ пиши слишком формально или сухо - пиши так, чтобы за текстом чувствовался живой человек
- НЕ упоминай опросы, по которым нет данных (например, Big Five)

Помни: твоя задача - дать руководителю глубокое, практичное понимание сотрудника как человека на основе психометрических данных.`;
  }

  /**
   * Построение промпта для генерации характеристики
   * Характеристика строится только на основе опросов DISC и BigFive
   */
  private buildPrompt(
    context: CharacteristicGenerationContext,
    dataRichness: DataRichnessLevel,
    excludeBigFive: boolean = false
  ): string {
    const { employee, surveys, previous_characteristic } = context;

    let prompt = `Создай характеристику для сотрудника:

**Информация о сотруднике:**
- ФИО: ${employee.first_name} ${employee.last_name}
- Должность: ${employee.position}
- Команда: ${employee.team}

**Уровень наполненности данных:** ${dataRichness.description}

`;

    // Уточняем какие опросы доступны в данных
    const hasDiscData = surveys.some(s => Boolean(s.metadata?.disc?.llmDescription) || Boolean(s.metadata?.disc?.profileHint));
    const hasBigFiveData = surveys.some(s => Boolean(s.metadata?.bigFive?.llmDescription) || (s.metadata?.bigFive?.averages && Object.keys(s.metadata.bigFive.averages).length > 0));
    const availableSurveys = [hasDiscData ? 'DISC' : null, hasBigFiveData ? 'Big Five' : null].filter(Boolean).join(', ');
    prompt += `**Доступные опросы в данных:** ${availableSurveys || 'нет'}\n\n`;

    // Добавляем информацию из опросов
    if (surveys.length > 0) {
      const recentSurveys = surveys.slice(0, 5);
      prompt += `**Пройдено опросов:** ${surveys.length}\n\n`;
      prompt += `**Результаты психометрических опросов:**\n`;

      recentSurveys.forEach((survey, idx) => {
        prompt += `\nОпрос ${idx + 1}: ${survey.title}\n`;

        // DISC профиль
        if (survey.metadata?.disc?.llmDescription) {
          prompt += `DISC профиль: ${survey.metadata.disc.llmDescription}\n`;
        } else if (survey.metadata?.disc?.profileHint) {
          prompt += `DISC: ${survey.metadata.disc.profileHint}\n`;
        }

        // Big Five — по запросу может быть исключён из общей характеристики
        if (!excludeBigFive) {
          if (survey.metadata?.bigFive?.llmDescription) {
            prompt += `Big Five: ${survey.metadata.bigFive.llmDescription}\n`;
          }
        }
      });
    }

    // Добавляем предыдущую характеристику для контекста
    if (previous_characteristic) {
      prompt += `\n\n**Предыдущая характеристика (для сравнения):**\n${previous_characteristic}\n`;
      prompt += `\nЕсли появились новые данные из опросов — обнови характеристику. Если данные не изменились — сохрани основные тезисы.\n`;
    }

    prompt += `\n\nТеперь создай характеристику этого сотрудника на основе психометрических профилей.

ВАЖНО:
- Объем: 200-250 слов (2-3 абзаца)
- Опирайся на данные опросов DISC и Big Five
- Синтезируй информацию в целостный портрет человека
- Дай практичные рекомендации по взаимодействию
- Не упоминай опросы, которых нет в данных${excludeBigFive ? ' (данных Big Five нет — не упоминай Big Five)' : ''}`;

    return prompt;
  }

  /**
   * Проверка наличия данных Big Five в контексте
   */
  private contextHasBigFiveData(context: CharacteristicGenerationContext): boolean {
    return context.surveys.some(s => {
      const hasLLM = Boolean(s.metadata?.bigFive?.llmDescription);
      const hasAverages = Boolean(s.metadata?.bigFive?.averages && Object.keys(s.metadata.bigFive.averages).length > 0);
      return hasLLM || hasAverages;
    });
  }

  /**
   * Сборка отпечатка контекста (для детекции изменений)
   * Учитывает только опросы, т.к. характеристика строится на их основе
   */
  private buildContextFingerprint(context: CharacteristicGenerationContext): string {
    const position = context.employee.position || '';
    const surveysCount = context.surveys.length;
    const lastSurvey = context.surveys[0]?.completed_at || '';
    return [position, String(surveysCount), String(lastSurvey)].join('|');
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

