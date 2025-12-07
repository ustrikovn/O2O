/**
 * Политики управления поведением ассистента
 * 
 * Включает:
 * - Debounce для ожидания паузы в вводе
 * - Подсчёт новых слов с последней рекомендации
 * - Throttling между ответами
 */

import { ASSISTANT_CONFIG } from './config.js';

type SessionKey = string; // meetingId:employeeId

// ============================================
// ХРАНИЛИЩА СОСТОЯНИЯ СЕССИЙ
// ============================================

/** Время последнего сообщения ассистента по сессии */
const lastMessageAt = new Map<SessionKey, number>();

/** Время последнего изменения заметок по сессии */
const lastNotesAt = new Map<SessionKey, number>();

/** Текст заметок на момент последней рекомендации */
const textAtLastRecommendation = new Map<SessionKey, string>();

/** Сессии, где уже предложили опрос */
const surveyOffered = new Set<SessionKey>();

// ============================================
// ФУНКЦИИ ФОРМИРОВАНИЯ КЛЮЧА
// ============================================

/**
 * Формирует ключ сессии из meetingId и employeeId
 */
export function sessionKey(meetingId: string, employeeId: string): SessionKey {
  return `${meetingId}:${employeeId}`;
}

// ============================================
// THROTTLING МЕЖДУ ОТВЕТАМИ
// ============================================

/**
 * Проверяет, можно ли отвечать сейчас (throttling).
 * Возвращает true, если прошло достаточно времени с последнего ответа.
 */
export function canRespondNow(key: SessionKey): boolean {
  const now = Date.now();
  const last = lastMessageAt.get(key) || 0;
  if (now - last < ASSISTANT_CONFIG.minIntervalMs) return false;
  lastMessageAt.set(key, now);
  return true;
}

// ============================================
// DEBOUNCE ДЛЯ ЗАМЕТОК
// ============================================

/**
 * Проверяет, нужно ли обрабатывать заметки сейчас (debounce).
 * Возвращает true, если прошло достаточно времени с последнего изменения.
 */
export function shouldProcessNotesNow(key: SessionKey): boolean {
  const now = Date.now();
  const last = lastNotesAt.get(key) || 0;
  if (now - last < ASSISTANT_CONFIG.debounceMs) return false;
  lastNotesAt.set(key, now);
  return true;
}

// ============================================
// ПОДСЧЁТ НОВЫХ СЛОВ
// ============================================

/**
 * Подсчитывает количество слов в тексте.
 * Разбивает по пробелам и знакам препинания, фильтрует пустые.
 */
function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text
    .trim()
    .split(/[\s\n\r\t]+/)
    .filter(word => word.length > 0)
    .length;
}

/**
 * Подсчитывает количество НОВЫХ слов между старым и новым текстом.
 * Используем простой подход: разница в общем количестве слов.
 * 
 * @param oldText - текст на момент последней рекомендации
 * @param newText - текущий текст
 * @returns количество добавленных слов
 */
export function countNewWords(oldText: string | undefined, newText: string): number {
  const oldCount = countWords(oldText || '');
  const newCount = countWords(newText);
  return Math.max(0, newCount - oldCount);
}

/**
 * Проверяет, достаточно ли новых слов для запуска анализа.
 * 
 * @param key - ключ сессии
 * @param currentText - текущий текст заметок
 * @returns true, если новых слов достаточно для анализа
 */
export function hasEnoughNewWords(key: SessionKey, currentText: string): boolean {
  const lastText = textAtLastRecommendation.get(key) || '';
  const newWordsCount = countNewWords(lastText, currentText);
  
  console.log(`[Policies] Новых слов: ${newWordsCount}, минимум: ${ASSISTANT_CONFIG.minWordsDelta}`);
  
  return newWordsCount >= ASSISTANT_CONFIG.minWordsDelta;
}

/**
 * Сохраняет текст заметок как базу для следующего подсчёта.
 * Вызывать ПОСЛЕ успешной рекомендации ассистента.
 * 
 * @param key - ключ сессии
 * @param text - текст заметок на момент рекомендации
 */
export function markTextAtRecommendation(key: SessionKey, text: string): void {
  textAtLastRecommendation.set(key, text);
}

/**
 * Получает текст заметок на момент последней рекомендации.
 * 
 * @param key - ключ сессии
 * @returns текст или пустая строка
 */
export function getTextAtLastRecommendation(key: SessionKey): string {
  return textAtLastRecommendation.get(key) || '';
}

// ============================================
// КОМБИНИРОВАННАЯ ПРОВЕРКА ДЛЯ АНАЛИЗА
// ============================================

/**
 * Проверяет ВСЕ условия для запуска анализа:
 * 1. Прошло достаточно времени (debounce)
 * 2. Добавлено достаточно новых слов
 * 
 * @param key - ключ сессии
 * @param currentText - текущий текст заметок
 * @returns объект с результатом и причиной отказа (если есть)
 */
export function shouldAnalyze(
  key: SessionKey, 
  currentText: string
): { should: boolean; reason?: string } {
  // Проверка debounce
  const now = Date.now();
  const lastNotes = lastNotesAt.get(key) || 0;
  if (now - lastNotes < ASSISTANT_CONFIG.debounceMs) {
    return { 
      should: false, 
      reason: `Debounce: прошло ${now - lastNotes}ms из ${ASSISTANT_CONFIG.debounceMs}ms` 
    };
  }
  
  // Проверка новых слов
  if (!hasEnoughNewWords(key, currentText)) {
    const lastText = textAtLastRecommendation.get(key) || '';
    const newWords = countNewWords(lastText, currentText);
    return { 
      should: false, 
      reason: `Мало новых слов: ${newWords} из ${ASSISTANT_CONFIG.minWordsDelta} минимум` 
    };
  }
  
  // Обновляем время последних заметок
  lastNotesAt.set(key, now);
  
  return { should: true };
}

// ============================================
// УПРАВЛЕНИЕ ОПРОСОМ
// ============================================

/**
 * Проверяет, был ли уже предложен опрос в этой сессии.
 */
export function wasSurveyOffered(key: SessionKey): boolean {
  return surveyOffered.has(key);
}

/**
 * Отмечает, что опрос был предложен.
 */
export function markSurveyOffered(key: SessionKey): void {
  surveyOffered.add(key);
}

// ============================================
// ОЧИСТКА СЕССИИ
// ============================================

/**
 * Очищает все данные сессии.
 * Вызывать при завершении встречи.
 */
export function clearSession(key: SessionKey): void {
  lastMessageAt.delete(key);
  lastNotesAt.delete(key);
  textAtLastRecommendation.delete(key);
  surveyOffered.delete(key);
}
