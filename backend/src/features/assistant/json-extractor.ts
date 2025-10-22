/**
 * Надёжный извлекатель JSON из ответа LLM. Возвращает текст как есть,
 * а также пытается найти JSON-блок в тройных кавычках или фигурных скобках.
 */
export function extractJsonIfAny(text: string): { plain: string; json?: unknown } {
  if (!text) return { plain: '' };
  let json: unknown | undefined;
  try {
    // Ищем блок в тройных кавычках
    const triple = text.match(/```json[\s\S]*?```/i) || text.match(/```[\s\S]*?```/);
    if (triple) {
      const raw = triple[0].replace(/```json|```/gi, '').trim();
      json = JSON.parse(raw);
    } else {
      // Пытаемся найти первый валидный JSON по фигурным скобкам
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const maybe = text.slice(start, end + 1);
        json = JSON.parse(maybe);
      }
    }
  } catch {
    // Игнорируем
  }
  return { plain: text, ...(json !== undefined ? { json } : {}) };
}


