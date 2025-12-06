const notesDebounceMs = 300;  // Быстрая реакция на изменения
const minIntervalMs = 800;    // Минимальный интервал между ответами

type SessionKey = string; // meetingId:employeeId

const lastMessageAt = new Map<SessionKey, number>();
const lastNotesAt = new Map<SessionKey, number>();
const surveyOffered = new Set<SessionKey>();

export function sessionKey(meetingId: string, employeeId: string): SessionKey {
  return `${meetingId}:${employeeId}`;
}

export function canRespondNow(key: SessionKey): boolean {
  const now = Date.now();
  const last = lastMessageAt.get(key) || 0;
  if (now - last < minIntervalMs) return false;
  lastMessageAt.set(key, now);
  return true;
}

export function shouldProcessNotesNow(key: SessionKey): boolean {
  const now = Date.now();
  const last = lastNotesAt.get(key) || 0;
  if (now - last < notesDebounceMs) return false;
  lastNotesAt.set(key, now);
  return true;
}

export function wasSurveyOffered(key: SessionKey): boolean {
  return surveyOffered.has(key);
}

export function markSurveyOffered(key: SessionKey): void {
  surveyOffered.add(key);
}


