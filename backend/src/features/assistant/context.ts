import { MeetingEntity } from '@/entities/meeting/index.js';
import { EmployeeEntity } from '@/entities/employee/index.js';
import { CharacteristicEntity } from '@/entities/characteristic/index.js';
import { AgreementEntity, Agreement } from '@/entities/agreement/model/agreement.js';

/** Договорённость с информацией о давности */
export interface AgreementWithAge {
  id: string;
  title: string;
  responsible_type: 'employee_task' | 'manager_task';
  status: string;
  due_date?: string;
  created_at: string;
  days_ago: number;
  weight: string; // "ВЕС 3x", "ВЕС 2x", "ВЕС 1x"
  is_overdue: boolean;
}

export interface AssistantContextSummary {
  employee: {
    id: string;
    name: string;
    email?: string;
    position?: string;
    team?: string;
  };
  meeting?: {
    id: string;
    status: string;
    started_at?: string;
    notes?: string;
  };
  stats?: {
    agreements_open?: number;
    agreements_overdue?: number;
    last_completed_meeting?: string | null;
  };
  /** Открытые договорённости с деталями и весом */
  openAgreements?: AgreementWithAge[];
  characteristic?: string | null;
}

/** История встречи для Analyst */
export interface PreviousMeetingSummary {
  date: string;
  notes?: string;
  satisfaction?: number;
  agreements_count?: number;
}

export async function buildAssistantContext(meetingId: string, employeeId: string): Promise<AssistantContextSummary> {
  const [employee, meeting] = await Promise.all([
    EmployeeEntity.findById(employeeId),
    MeetingEntity.findById(meetingId)
  ]);

  if (!employee) {
    throw new Error('Сотрудник не найден');
  }

  let characteristicText: string | null = null;
  try {
    const ch = await CharacteristicEntity.findByEmployeeId(employeeId);
    characteristicText = ch?.content || null;
  } catch {}

  // Получаем открытые договорённости с деталями
  let openAgreementsList: AgreementWithAge[] = [];
  let agreementsOpen = 0;
  let agreementsOverdue = 0;
  try {
    const list = await AgreementEntity.getOpenByEmployeeId(employeeId);
    agreementsOpen = list.length;
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    openAgreementsList = list.map(a => {
      const createdAt = new Date(a.created_at);
      const daysAgo = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const weight = daysAgo <= 7 ? 'ВЕС 3x' : daysAgo <= 21 ? 'ВЕС 2x' : 'ВЕС 1x';
      const isOverdue = a.due_date ? a.due_date < today : false;
      
      if (isOverdue) agreementsOverdue++;
      
      return {
        id: a.id,
        title: a.title,
        responsible_type: a.responsible_type,
        status: a.status,
        due_date: a.due_date,
        created_at: createdAt.toISOString().split('T')[0],
        days_ago: daysAgo,
        weight,
        is_overdue: isOverdue
      };
    });
  } catch {}

  let lastCompletedMeeting: string | null = null;
  try {
    const m = await MeetingEntity.findLastCompletedWithAgreements(employeeId);
    lastCompletedMeeting = (m?.ended_at as any) || null;
  } catch {}

  const result: AssistantContextSummary = {
    employee: {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      email: employee.email,
      position: employee.position,
      team: employee.team
    },
    stats: {
      agreements_open: agreementsOpen,
      agreements_overdue: agreementsOverdue,
      last_completed_meeting: lastCompletedMeeting
    },
    openAgreements: openAgreementsList,
    characteristic: characteristicText
  };

  if (meeting) {
    const meetingObj: { id: string; status: string; started_at?: string; notes?: string } = {
      id: meeting.id,
      status: String(meeting.status)
    };
    const startedAt = (meeting as any).started_at;
    if (startedAt !== undefined && startedAt !== null) {
      meetingObj.started_at = String(startedAt);
    }
    const notesVal = (meeting as any).content?.notes;
    if (notesVal !== undefined && notesVal !== null) {
      meetingObj.notes = String(notesVal);
    }
    (result as any).meeting = meetingObj;
  }

  return result;
}

/**
 * Получить историю последних встреч с сотрудником
 * 
 * @param employeeId - ID сотрудника
 * @param limit - максимальное количество встреч (по умолчанию 5)
 */
export async function getPreviousMeetings(
  employeeId: string, 
  limit: number = 5
): Promise<PreviousMeetingSummary[]> {
  try {
    const meetings = await MeetingEntity.findAll(
      { employeeId, status: 'completed' },
      limit,
      0
    );
    
    return meetings.map(m => {
      const summary: PreviousMeetingSummary = {
        date: m.ended_at ? new Date(m.ended_at).toISOString().split('T')[0] : 
              m.started_at ? new Date(m.started_at).toISOString().split('T')[0] : 
              'unknown'
      };
      
      // Заметки из content
      const notes = (m.content as any)?.notes;
      if (notes && typeof notes === 'string' && notes.trim().length > 0) {
        summary.notes = notes.slice(0, 500); // Ограничиваем длину
      }
      
      // Оценка удовлетворённости (если есть в content)
      const satisfaction = (m.content as any)?.satisfaction;
      if (typeof satisfaction === 'number') {
        summary.satisfaction = satisfaction;
      }
      
      // Количество договорённостей
      const agreements = (m.content as any)?.agreements;
      if (Array.isArray(agreements)) {
        summary.agreements_count = agreements.length;
      }
      
      return summary;
    });
    
  } catch (error) {
    console.error('[Context] Ошибка получения истории встреч:', error);
    return [];
  }
}
