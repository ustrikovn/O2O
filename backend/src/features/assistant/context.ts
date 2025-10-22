import { MeetingEntity } from '@/entities/meeting/index.js';
import { EmployeeEntity } from '@/entities/employee/index.js';
import { CharacteristicEntity } from '@/entities/characteristic/index.js';
import { AgreementEntity } from '@/entities/agreement/model/agreement.js';

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
    last_completed_meeting?: string | null;
  };
  characteristic?: string | null;
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

  let agreementsOpen = 0;
  try {
    const list = await AgreementEntity.getOpenByEmployeeId(employeeId);
    agreementsOpen = list.length;
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
      last_completed_meeting: lastCompletedMeeting
    },
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


