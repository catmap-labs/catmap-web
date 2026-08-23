export type CareTask = 'food' | 'water' | 'cleanup' | 'catCheck';
export type CareStatus = 'caredToday' | 'dueSoon' | 'needsSomeone';
export type ShiftStatus = 'open' | 'assigned' | 'completed';
export type HandoffStatus = 'open' | 'covered';

export interface Profile {
  id: string;
  displayName: string;
  avatarInitials: string;
  locale: string;
  timezone: string;
}

export interface Spot {
  id: string;
  name: string;
  description: string;
  exactLatitude: number;
  exactLongitude: number;
  publicLatitude: number;
  publicLongitude: number;
  status: CareStatus;
  distanceMeters: number;
  catCountEstimate: number;
  routineId: string;
  caretakerProfileId: string;
  lastCaredAt?: string;
  lastCaredBy?: string;
  nextCareAt: string;
}

export interface SpotMember {
  id: string;
  spotId: string;
  profileId: string;
  role: 'caretaker' | 'helper';
}

export interface Routine {
  id: string;
  spotId: string;
  label: string;
  tasks: CareTask[];
  localTime: string;
}

export interface Shift {
  id: string;
  spotId: string;
  startsAt: string;
  tasks: CareTask[];
  status: ShiftStatus;
  assignedToProfileId?: string;
  source: 'routine' | 'handoff';
}

export interface Assignment {
  id: string;
  shiftId: string;
  profileId: string;
  acceptedAt: string;
}

export interface CareLog {
  id: string;
  spotId: string;
  profileId: string;
  caredAt: string;
  tasks: CareTask[];
  foodAmount?: 'small' | 'medium' | 'large';
  catsSeen?: number;
  cleanupConfirmed?: boolean;
  note?: string;
}

export interface HandoffRequest {
  id: string;
  spotId: string;
  caretakerProfileId: string;
  fromDate: string;
  untilDate: string;
  tasks: CareTask[];
  message: string;
  shiftIds: string[];
  status: HandoffStatus;
}

export interface DemoState {
  profiles: Profile[];
  spots: Spot[];
  members: SpotMember[];
  routines: Routine[];
  shifts: Shift[];
  assignments: Assignment[];
  careLogs: CareLog[];
  handoffRequests: HandoffRequest[];
}
