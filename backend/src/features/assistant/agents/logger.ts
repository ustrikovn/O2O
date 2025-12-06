/**
 * Логгер для LLM Pipeline
 * 
 * Отслеживает:
 * - Время выполнения каждого агента
 * - Решения Decision (молчать/говорить)
 * - Метрики для анализа эффективности
 */

import type { AnalystOutput, DecisionOutput, ComposerOutput } from './types.js';

// ============================================
// МЕТРИКИ
// ============================================

interface PipelineMetrics {
  /** Общее количество вызовов pipeline */
  total_calls: number;
  
  /** Количество раз когда Decision решил молчать */
  silence_count: number;
  
  /** Количество раз когда Decision решил говорить */
  intervene_count: number;
  
  /** Сумма времени Analyst (для расчёта среднего) */
  analyst_time_sum_ms: number;
  
  /** Сумма времени Decision */
  decision_time_sum_ms: number;
  
  /** Сумма времени Composer */
  composer_time_sum_ms: number;
  
  /** Распределение типов вмешательств */
  intervention_types: Record<string, number>;
}

/** Глобальные метрики сессии */
const metrics: PipelineMetrics = {
  total_calls: 0,
  silence_count: 0,
  intervene_count: 0,
  analyst_time_sum_ms: 0,
  decision_time_sum_ms: 0,
  composer_time_sum_ms: 0,
  intervention_types: {}
};

// ============================================
// ЛОГГЕР
// ============================================

/** Символы для красивого вывода */
const SYMBOLS = {
  TOP: '┌─',
  MID: '├─',
  BOT: '└─',
  LINE: '│',
  CHECK: '✅',
  CROSS: '❌',
  WARN: '⚠️',
  INFO: '💡',
  TIME: '⏱️',
  CHART: '📊'
};

/** Цвета для консоли (ANSI) */
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  CYAN: '\x1b[36m',
  YELLOW: '\x1b[33m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m'
};

/** Форматирование времени */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Обрезка текста */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/** Класс для логирования одного вызова pipeline */
export class PipelineLogger {
  private meetingId: string;
  private employeeId: string;
  private startTime: number;
  private analystTime?: number;
  private decisionTime?: number;
  private composerTime?: number;
  
  constructor(meetingId: string, employeeId: string) {
    this.meetingId = meetingId;
    this.employeeId = employeeId;
    this.startTime = Date.now();
    metrics.total_calls++;
  }
  
  /** Логирование начала pipeline */
  logStart(notes?: string): void {
    const c = COLORS;
    console.log('');
    console.log(`${c.CYAN}${SYMBOLS.TOP} PIPELINE ──────────────────────────────────${c.RESET}`);
    console.log(`${c.DIM}${SYMBOLS.LINE} meeting: ${this.meetingId.slice(0, 8)}...${c.RESET}`);
    console.log(`${c.DIM}${SYMBOLS.LINE} employee: ${this.employeeId.slice(0, 8)}...${c.RESET}`);
    if (notes) {
      console.log(`${c.DIM}${SYMBOLS.LINE} notes: "${truncate(notes, 50)}"${c.RESET}`);
    }
  }
  
  /** Логирование результата Analyst */
  logAnalyst(output: AnalystOutput, durationMs: number): void {
    this.analystTime = durationMs;
    metrics.analyst_time_sum_ms += durationMs;
    
    const c = COLORS;
    console.log(`${c.YELLOW}${SYMBOLS.MID} ANALYST (${formatTime(durationMs)}) ────────────────────${c.RESET}`);
    console.log(`${c.DIM}${SYMBOLS.LINE} insights: ${output.insights.length}, sentiment: ${output.employee_state.sentiment}${c.RESET}`);
    
    output.insights.forEach((insight, i) => {
      const text = insight.interpretation || insight.description || '';
      console.log(`${c.DIM}${SYMBOLS.LINE} [${i}] ${insight.type}: "${truncate(text, 40)}" (conf: ${insight.confidence.toFixed(1)})${c.RESET}`);
    });
  }
  
  /** Логирование результата Decision */
  logDecision(output: DecisionOutput, durationMs: number): void {
    this.decisionTime = durationMs;
    metrics.decision_time_sum_ms += durationMs;
    
    if (output.should_intervene) {
      metrics.intervene_count++;
      if (output.intervention_type) {
        metrics.intervention_types[output.intervention_type] = 
          (metrics.intervention_types[output.intervention_type] || 0) + 1;
      }
    } else {
      metrics.silence_count++;
    }
    
    const c = COLORS;
    const symbol = output.should_intervene ? SYMBOLS.CHECK : SYMBOLS.CROSS;
    const color = output.should_intervene ? c.GREEN : c.RED;
    
    console.log(`${c.BLUE}${SYMBOLS.MID} DECISION (${formatTime(durationMs)}) ───────────────────${c.RESET}`);
    console.log(`${color}${SYMBOLS.LINE} ${symbol} should_intervene: ${output.should_intervene}${c.RESET}`);
    console.log(`${c.DIM}${SYMBOLS.LINE} reason: "${truncate(output.reason, 50)}"${c.RESET}`);
    
    if (output.should_intervene && output.intervention_type) {
      console.log(`${c.DIM}${SYMBOLS.LINE} type: ${output.intervention_type}, priority: ${output.priority || 'medium'}${c.RESET}`);
    }
  }
  
  /** Логирование результата Composer */
  logComposer(output: ComposerOutput, durationMs: number): void {
    this.composerTime = durationMs;
    metrics.composer_time_sum_ms += durationMs;
    
    const c = COLORS;
    console.log(`${c.MAGENTA}${SYMBOLS.MID} COMPOSER (${formatTime(durationMs)}) ──────────────────${c.RESET}`);
    
    if (output.message) {
      console.log(`${c.DIM}${SYMBOLS.LINE} message: "${truncate(output.message.text, 50)}"${c.RESET}`);
    }
    if (output.action_card) {
      console.log(`${c.DIM}${SYMBOLS.LINE} action_card: ${output.action_card.kind}${c.RESET}`);
    }
  }
  
  /** Логирование завершения pipeline */
  logEnd(result: 'silence' | 'message' | 'error', errorMsg?: string): void {
    const totalTime = Date.now() - this.startTime;
    const c = COLORS;
    
    if (result === 'silence') {
      console.log(`${c.RED}${SYMBOLS.BOT} RESULT: молчим (${formatTime(totalTime)}) ────────────────${c.RESET}`);
    } else if (result === 'message') {
      console.log(`${c.GREEN}${SYMBOLS.BOT} RESULT: отправляем сообщение (${formatTime(totalTime)}) ──${c.RESET}`);
    } else {
      console.log(`${c.RED}${SYMBOLS.BOT} RESULT: ошибка - ${errorMsg} (${formatTime(totalTime)}) ──${c.RESET}`);
    }
    console.log('');
  }
  
  /** Быстрый лог для молчания без полного pipeline */
  logQuickSilence(reason: string): void {
    const c = COLORS;
    console.log(`${c.DIM}[PIPELINE] ${SYMBOLS.CROSS} ${reason}${c.RESET}`);
    metrics.total_calls++;
    metrics.silence_count++;
  }
}

// ============================================
// ФУНКЦИИ ДЛЯ МЕТРИК
// ============================================

/** Получить текущие метрики */
export function getMetrics(): {
  silence_rate: number;
  analyst_avg_ms: number;
  decision_avg_ms: number;
  composer_avg_ms: number;
  total_calls: number;
  intervention_types: Record<string, number>;
} {
  const total = metrics.total_calls || 1;
  const interveneCount = metrics.intervene_count || 1;
  
  return {
    silence_rate: (metrics.silence_count / total) * 100,
    analyst_avg_ms: metrics.analyst_time_sum_ms / total,
    decision_avg_ms: metrics.decision_time_sum_ms / total,
    composer_avg_ms: metrics.composer_time_sum_ms / interveneCount,
    total_calls: metrics.total_calls,
    intervention_types: { ...metrics.intervention_types }
  };
}

/** Вывести сводку метрик */
export function logMetricsSummary(): void {
  const m = getMetrics();
  const c = COLORS;
  
  console.log('');
  console.log(`${c.CYAN}${SYMBOLS.CHART} МЕТРИКИ PIPELINE ────────────────────────${c.RESET}`);
  console.log(`${c.DIM}${SYMBOLS.LINE} Всего вызовов: ${m.total_calls}${c.RESET}`);
  console.log(`${c.DIM}${SYMBOLS.LINE} Silence rate: ${m.silence_rate.toFixed(1)}%${c.RESET}`);
  console.log(`${c.DIM}${SYMBOLS.LINE} Avg Analyst: ${formatTime(m.analyst_avg_ms)}${c.RESET}`);
  console.log(`${c.DIM}${SYMBOLS.LINE} Avg Decision: ${formatTime(m.decision_avg_ms)}${c.RESET}`);
  console.log(`${c.DIM}${SYMBOLS.LINE} Avg Composer: ${formatTime(m.composer_avg_ms)}${c.RESET}`);
  
  if (Object.keys(m.intervention_types).length > 0) {
    console.log(`${c.DIM}${SYMBOLS.LINE} Типы вмешательств:${c.RESET}`);
    for (const [type, count] of Object.entries(m.intervention_types)) {
      console.log(`${c.DIM}${SYMBOLS.LINE}   ${type}: ${count}${c.RESET}`);
    }
  }
  console.log('');
}

/** Сбросить метрики */
export function resetMetrics(): void {
  metrics.total_calls = 0;
  metrics.silence_count = 0;
  metrics.intervene_count = 0;
  metrics.analyst_time_sum_ms = 0;
  metrics.decision_time_sum_ms = 0;
  metrics.composer_time_sum_ms = 0;
  metrics.intervention_types = {};
}


