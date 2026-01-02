/**
 * Typing Detector
 * 
 * Определяет когда пользователь прекратил печатать.
 * Использует серверный debounce: если в течение N секунд 
 * не было новых событий — пользователь сделал паузу.
 * 
 * Логика:
 * 1. При получении notes_update — запускаем таймер
 * 2. Если приходит новый notes_update — сбрасываем таймер
 * 3. Когда таймер истекает — вызываем callback (пауза обнаружена)
 */

import { ASSISTANT_CONFIG } from './config.js';
import { checkContentAfterPause, type ContentCheckResult } from './policies.js';

type SessionKey = string;
type OnPauseCallback = (notes: string, contentCheck: ContentCheckResult) => Promise<void>;
type OnLogCallback = (log: any) => void;

/** Активные таймеры по сессиям */
const debounceTimers = new Map<SessionKey, NodeJS.Timeout>();

/** Последний текст заметок по сессии (для передачи в callback) */
const lastNotesText = new Map<SessionKey, string>();

/** Callback для логов по сессии */
const logCallbacks = new Map<SessionKey, OnLogCallback>();

/**
 * Формирует ключ сессии
 */
export function sessionKey(meetingId: string, employeeId: string): string {
  return `${meetingId}:${employeeId}`;
}

/**
 * Регистрирует событие ввода текста.
 * Сбрасывает таймер и запускает новый.
 * Когда таймер истекает — вызывает callback (пауза обнаружена).
 * 
 * @param key - ключ сессии (meetingId:employeeId)
 * @param notes - текущий текст заметок
 * @param onPause - callback который вызовется когда пауза обнаружена
 * @param onLog - callback для отправки логов клиенту
 */
export function onTyping(
  key: SessionKey,
  notes: string,
  onPause: OnPauseCallback,
  onLog?: OnLogCallback
): void {
  // Сохраняем текст и callback для логов
  lastNotesText.set(key, notes);
  if (onLog) {
    logCallbacks.set(key, onLog);
  }
  
  // Проверяем есть ли уже активный таймер
  const existingTimer = debounceTimers.get(key);
  
  if (existingTimer) {
    // Таймер уже был — сбрасываем его
    clearTimeout(existingTimer);
    
    // Лог: пользователь продолжает печатать
    if (onLog) {
      onLog({
        type: 'pipeline_log',
        level: 'info',
        stage: 'typing_detection',
        message: `⌨️ Печатает... (таймер сброшен)`
      });
    }
  } else {
    // Первое событие — лог о начале ожидания
    if (onLog) {
      onLog({
        type: 'pipeline_log',
        level: 'info',
        stage: 'typing_detection',
        message: `⌨️ Печатает... ожидаем паузу ${ASSISTANT_CONFIG.debounceMs / 1000}с`
      });
    }
  }
  
  // Запускаем новый таймер
  const timer = setTimeout(async () => {
    // Таймер истёк — удаляем его из Map
    debounceTimers.delete(key);
    
    const text = lastNotesText.get(key) || '';
    const log = logCallbacks.get(key);
    
    // Лог: пауза обнаружена
    if (log) {
      log({
        type: 'pipeline_log',
        level: 'success',
        stage: 'typing_detection',
        message: `✅ Пауза ${ASSISTANT_CONFIG.debounceMs / 1000}с`
      });
    }
    
    // Проверяем контент: удаление, новые слова, минимум текста
    const contentCheck = checkContentAfterPause(key, text);
    
    // Лог: результат проверки контента
    if (log) {
      const icon = contentCheck.shouldAnalyze 
        ? (contentCheck.deletionDetected ? '🔄' : '📝')
        : '⏳';
      const level = contentCheck.shouldAnalyze ? 'success' : 'info';
      
      log({
        type: 'pipeline_log',
        level,
        stage: 'content_check',
        message: `${icon} ${contentCheck.reason}`
      });
    }
    
    // Вызываем callback только если нужен анализ
    if (contentCheck.shouldAnalyze) {
      try {
        await onPause(text, contentCheck);
      } catch (error) {
        console.error('[TypingDetector] Ошибка в onPause callback:', error);
      }
    }
  }, ASSISTANT_CONFIG.debounceMs);
  
  debounceTimers.set(key, timer);
}

/**
 * Очистка таймера при отключении сессии
 */
export function clearTypingSession(key: SessionKey): void {
  const timer = debounceTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(key);
  }
  lastNotesText.delete(key);
  logCallbacks.delete(key);
}

/**
 * Проверка активен ли таймер для сессии (для отладки)
 */
export function isTyping(key: SessionKey): boolean {
  return debounceTimers.has(key);
}

