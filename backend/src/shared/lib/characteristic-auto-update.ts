/**
 * Утилита для автоматического обновления характеристик сотрудников
 */

import { CharacteristicEntity } from '@/entities/characteristic/index.js';
import { CharacteristicGenerationService } from './characteristic-generation.js';

const generationService = new CharacteristicGenerationService();

// Кэш для предотвращения множественных одновременных генераций
const generationInProgress = new Set<string>();

/**
 * Автоматическое обновление характеристики сотрудника
 * Вызывается после изменения контекста о сотруднике
 */
export async function autoUpdateCharacteristic(employeeId: string): Promise<void> {
  // Проверяем, не идет ли уже генерация для этого сотрудника
  if (generationInProgress.has(employeeId)) {
    console.log(`Характеристика для сотрудника ${employeeId} уже обновляется, пропускаем`);
    return;
  }

  try {
    generationInProgress.add(employeeId);
    
    console.log(`Автообновление характеристики для сотрудника ${employeeId}...`);
    
    // Получаем текущую характеристику (если есть)
    const existing = await CharacteristicEntity.findByEmployeeId(employeeId);
    // Вычисляем текущий отпечаток контекста
    const { fingerprint } = await generationService.computeContextFingerprint(employeeId);

    const prevFingerprint = existing?.metadata?.generation_metadata?.context_fingerprint;
    if (prevFingerprint && prevFingerprint === fingerprint) {
      console.log(`Контекст сотрудника ${employeeId} не изменился — обновление характеристики не требуется`);
      return;
    }

    // Генерируем новую характеристику
    const result = await generationService.generateCharacteristic(
      employeeId,
      existing?.content
    );
    
    // Сохраняем (upsert)
    await CharacteristicEntity.upsert(employeeId, result);
    
    console.log(`✅ Характеристика для сотрудника ${employeeId} успешно обновлена`);
  } catch (error) {
    console.error(`❌ Ошибка автообновления характеристики для сотрудника ${employeeId}:`, error);
    // Не бросаем ошибку наверх, чтобы не сломать основной процесс
  } finally {
    generationInProgress.delete(employeeId);
  }
}

/**
 * Асинхронное обновление характеристики (fire-and-forget)
 * Для случаев, когда не нужно ждать завершения
 */
export function autoUpdateCharacteristicAsync(employeeId: string): void {
  autoUpdateCharacteristic(employeeId).catch(error => {
    console.error(`Ошибка асинхронного обновления характеристики:`, error);
  });
}

