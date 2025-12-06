/**
 * Тест-скрипт для проверки LLM Pipeline
 * 
 * Запуск: npx tsx src/scripts/test-pipeline.ts
 */

import 'dotenv/config';
import { AnalystAgent } from '../features/assistant/agents/analyst.js';
import { DecisionAgent } from '../features/assistant/agents/decision.js';
import { ComposerAgent } from '../features/assistant/agents/composer.js';
import { PipelineLogger, logMetricsSummary, resetMetrics } from '../features/assistant/agents/logger.js';
import type { DecisionInput, AnalystInput, ComposerInput, InterventionType, AnalystInsight } from '../features/assistant/agents/types.js';

async function testFullPipeline() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   ТЕСТ LLM PIPELINE - Analyst + Decision + Composer');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  
  const analystAgent = new AnalystAgent();
  const decisionAgent = new DecisionAgent();
  const composerAgent = new ComposerAgent();
  
  // ═══════════════════════════════════════════════════════════════
  // Тест 1: Короткие заметки → Analyst минимальный → Decision молчит
  // ═══════════════════════════════════════════════════════════════
  console.log('📝 Тест 1: Короткие заметки (ожидаем: молчим)');
  console.log('─'.repeat(60));
  
  const logger1 = new PipelineLogger('test-1', 'emp-1');
  logger1.logStart('привет');
  
  const analystInput1: AnalystInput = {
    notes: 'привет',
    employee: { id: 'emp-1', name: 'Иван Петров', position: 'Developer', team: 'Backend' },
    characteristic: null,
    previousMeetings: [],
    openAgreements: 0
  };
  
  const { output: analysis1, durationMs: analysisDuration1 } = await analystAgent.analyze(analystInput1);
  logger1.logAnalyst(analysis1, analysisDuration1);
  
  const decisionInput1: DecisionInput = {
    analysis: analysis1,
    context: { meeting_duration_minutes: 2, messages_sent_this_session: 0 },
    recentAssistantMessages: []
  };
  
  const { output: decision1, durationMs: decisionDuration1 } = await decisionAgent.decide(decisionInput1);
  logger1.logDecision(decision1, decisionDuration1);
  logger1.logEnd(decision1.should_intervene ? 'message' : 'silence');
  
  // ═══════════════════════════════════════════════════════════════
  // Тест 2: Риск выгорания → Analyst находит риск → Decision говорит
  // ═══════════════════════════════════════════════════════════════
  console.log('');
  console.log('📝 Тест 2: Риск выгорания (ожидаем: говорим, warning)');
  console.log('─'.repeat(60));
  
  const logger2 = new PipelineLogger('test-2', 'emp-2');
  const notes2 = `Мария сегодня выглядит уставшей. Сказала что последние недели очень тяжело давалась работа. 
Не видит перспектив в текущем проекте. Думает о том, чтобы сменить команду или даже компанию. 
Жалуется на переработки и отсутствие баланса.`;
  
  logger2.logStart(notes2.slice(0, 50) + '...');
  
  const analystInput2: AnalystInput = {
    notes: notes2,
    employee: { id: 'emp-2', name: 'Мария Сидорова', position: 'Senior Developer', team: 'Frontend' },
    characteristic: 'Мотивируется интересными задачами и развитием. Ценит work-life balance.',
    previousMeetings: [
      { date: '2024-11-15', notes: 'Всё хорошо, проект идёт по плану', satisfaction: 7 },
      { date: '2024-10-20', notes: 'Небольшая усталость, но справляется', satisfaction: 6 }
    ],
    openAgreements: 2
  };
  
  const { output: analysis2, durationMs: analysisDuration2 } = await analystAgent.analyze(analystInput2);
  logger2.logAnalyst(analysis2, analysisDuration2);
  
  const decisionInput2: DecisionInput = {
    analysis: analysis2,
    context: { meeting_duration_minutes: 15, messages_sent_this_session: 0 },
    recentAssistantMessages: []
  };
  
  const { output: decision2, durationMs: decisionDuration2 } = await decisionAgent.decide(decisionInput2);
  logger2.logDecision(decision2, decisionDuration2);
  
  // Composer (только если Decision решил говорить)
  let composerOutput2 = null;
  if (decision2.should_intervene) {
    const insight2 = analysis2.insights[decision2.insight_index || 0] || analysis2.insights[0];
    const defaultInsight: AnalystInsight = {
      type: 'risk',
      interpretation: analysis2.context_summary,
      confidence: 0.5,
      evidence: [],
      relevance: 'medium'
    };
    const composerInput2: ComposerInput = {
      intervention_type: (decision2.intervention_type || 'warning') as InterventionType,
      insight: insight2 || defaultInsight,
      employee_name: 'Мария Сидорова',
      context_summary: analysis2.context_summary
    };
    
    const { output: composed2, durationMs: composerDuration2 } = await composerAgent.compose(composerInput2);
    composerOutput2 = composed2;
    logger2.logComposer(composed2, composerDuration2);
  }
  logger2.logEnd(decision2.should_intervene ? 'message' : 'silence');
  
  // ═══════════════════════════════════════════════════════════════
  // Тест 3: Обычная встреча → молчим
  // ═══════════════════════════════════════════════════════════════
  console.log('');
  console.log('📝 Тест 3: Обычная встреча (ожидаем: молчим)');
  console.log('─'.repeat(60));
  
  const logger3 = new PipelineLogger('test-3', 'emp-3');
  const notes3 = 'Обсудили текущие задачи по проекту. Всё идёт по плану.';
  
  logger3.logStart(notes3);
  
  const analystInput3: AnalystInput = {
    notes: notes3,
    employee: { id: 'emp-3', name: 'Алексей Козлов', position: 'Developer', team: 'Mobile' },
    characteristic: null,
    previousMeetings: [],
    openAgreements: 1
  };
  
  const { output: analysis3, durationMs: analysisDuration3 } = await analystAgent.analyze(analystInput3);
  logger3.logAnalyst(analysis3, analysisDuration3);
  
  const decisionInput3: DecisionInput = {
    analysis: analysis3,
    context: { meeting_duration_minutes: 10, messages_sent_this_session: 2 },
    recentAssistantMessages: ['Как дела с задачей?', 'Отлично!']
  };
  
  const { output: decision3, durationMs: decisionDuration3 } = await decisionAgent.decide(decisionInput3);
  logger3.logDecision(decision3, decisionDuration3);
  logger3.logEnd(decision3.should_intervene ? 'message' : 'silence');
  
  // ═══════════════════════════════════════════════════════════════
  // Итоги
  // ═══════════════════════════════════════════════════════════════
  console.log('');
  logMetricsSummary();
  
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   РЕЗУЛЬТАТЫ ТЕСТОВ');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  
  const tests = [
    { 
      name: 'Короткие заметки', 
      expected: false, 
      actual: decision1.should_intervene,
      details: decision1.reason.slice(0, 50)
    },
    { 
      name: 'Риск выгорания', 
      expected: true, 
      actual: decision2.should_intervene,
      details: `${decision2.intervention_type || 'none'}, ${decision2.priority || 'none'}`
    },
    { 
      name: 'Обычная встреча', 
      expected: false, 
      actual: decision3.should_intervene,
      details: decision3.reason.slice(0, 50)
    }
  ];
  
  let passed = 0;
  for (const test of tests) {
    const status = test.expected === test.actual ? '✅ PASS' : '❌ FAIL';
    if (test.expected === test.actual) passed++;
    console.log(`${status}: ${test.name}`);
    console.log(`       Ожидали: ${test.expected}, получили: ${test.actual}`);
    console.log(`       Детали: ${test.details}`);
    console.log('');
  }
  
  console.log('─'.repeat(60));
  console.log(`Пройдено: ${passed}/${tests.length}`);
  console.log('');
  
  // Проверка качества анализа
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   КАЧЕСТВО АНАЛИЗА (Тест 2 - выгорание)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Sentiment: ${analysis2.employee_state.sentiment}`);
  console.log(`Engagement: ${analysis2.employee_state.engagement_level}`);
  console.log(`Темы: ${analysis2.employee_state.key_topics.join(', ') || 'не определены'}`);
  console.log(`Инсайтов: ${analysis2.insights.length}`);
  analysis2.insights.forEach((ins, i) => {
    const text = ins.interpretation || ins.description || '';
    console.log(`  [${i}] ${ins.type}: ${text.slice(0, 60)}... (conf: ${ins.confidence.toFixed(2)})`);
  });
  console.log('');
  
  // Проверка качества Composer
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   РЕЗУЛЬТАТ COMPOSER (Тест 2)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  if (composerOutput2?.message) {
    console.log(`Сообщение: "${composerOutput2.message.text}"`);
    console.log(`Формат: ${composerOutput2.message.format}`);
  } else if (composerOutput2?.action_card) {
    console.log(`Action Card: ${composerOutput2.action_card.kind}`);
    console.log(`Title: ${composerOutput2.action_card.title}`);
  } else {
    console.log('Composer не был вызван');
  }
  console.log('');
}

// Запуск
resetMetrics();
testFullPipeline().catch(console.error);
