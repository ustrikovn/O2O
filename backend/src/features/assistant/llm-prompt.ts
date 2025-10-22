export function buildSystemPrompt(): string {
  return `Ты — ассистент руководителя во время one-to-one. Отвечай кратко, по делу, без лонгридов. Максимум 3 пункта, ≤ 420 символов. Формат:
1) Наблюдение/вывод
2) Рекомендация
3) Возможное действие (CTA)`;
}

export function buildUserPrompt(input: {
  contextCompact: string;
  lastUserText?: string;
  lastNotes?: string;
}): string {
  const parts: string[] = [];
  parts.push(`Контекст встречи и сотрудника (сжатый): ${input.contextCompact}`);
  if (input.lastNotes) parts.push(`Текущие заметки: ${input.lastNotes.slice(0, 800)}`);
  if (input.lastUserText) parts.push(`Сообщение руководителя: ${input.lastUserText}`);
  parts.push(
    `Дай очень краткий ответ (рус.), до 3 пунктов. Если профиль пуст или беден, предложи 1 релевантный опрос (не более одного за встречу).`
  );
  return parts.join('\n');
}


