import { currentProfileId, createDemoState } from './demoData';
import { CareLog, CareTask, DemoState, HandoffRequest, Spot } from '../../types/domain';

const storageKey = 'catmap-demo-state-v1';

const read = (): DemoState => {
  const fallback = createDemoState();
  const raw = localStorage.getItem(storageKey);
  if (!raw) return fallback;
  try {
    const stored = JSON.parse(raw) as Partial<DemoState>;
    return {
      ...fallback,
      ...stored,
      cats: stored.cats ?? fallback.cats,
    };
  } catch {
    return fallback;
  }
};

const write = (state: DemoState) => localStorage.setItem(storageKey, JSON.stringify(state));

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayDoneStatus = 'caredToday' as const;

export const demoRepository = {
  load(): DemoState {
    const state = read();
    write(state);
    return state;
  },
  save(state: DemoState) {
    write(state);
  },
  takeShift(state: DemoState, shiftId: string): DemoState {
    const next = structuredClone(state);
    const shift = next.shifts.find((item) => item.id === shiftId);
    if (shift && shift.status !== 'completed') {
      shift.status = 'assigned';
      shift.assignedToProfileId = currentProfileId;
      next.assignments.push({ id: uid('assignment'), shiftId, profileId: currentProfileId, acceptedAt: new Date().toISOString() });
    }
    write(next);
    return next;
  },
  completeCare(state: DemoState, payload: Omit<CareLog, 'id' | 'profileId' | 'caredAt'>): DemoState {
    const next = structuredClone(state);
    const caredAt = new Date().toISOString();
    next.careLogs.unshift({ ...payload, id: uid('log'), profileId: currentProfileId, caredAt });
    const spot = next.spots.find((item) => item.id === payload.spotId);
    if (spot) {
      spot.status = todayDoneStatus;
      spot.lastCaredAt = caredAt;
      spot.lastCaredBy = 'Alex';
    }
    next.shifts
      .filter((shift) => shift.spotId === payload.spotId && shift.status !== 'completed')
      .forEach((shift) => {
        shift.status = 'completed';
        shift.assignedToProfileId = currentProfileId;
      });
    write(next);
    return next;
  },
  createHandoff(state: DemoState, spotId: string, fromDate: string, untilDate: string, tasks: CareTask[], message: string): DemoState {
    const next = structuredClone(state);
    const shiftIds: string[] = [];
    const start = new Date(`${fromDate}T19:00:00`);
    const end = new Date(`${untilDate}T19:00:00`);
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const id = uid('shift-handoff');
      shiftIds.push(id);
      next.shifts.push({
        id,
        spotId,
        startsAt: cursor.toISOString(),
        tasks,
        status: 'open',
        source: 'handoff',
      });
    }
    const request: HandoffRequest = {
      id: uid('handoff'),
      spotId,
      caretakerProfileId: currentProfileId,
      fromDate,
      untilDate,
      tasks,
      message,
      shiftIds,
      status: 'open',
    };
    next.handoffRequests.unshift(request);
    write(next);
    return next;
  },
  createSpot(state: DemoState, spot: Pick<Spot, 'name' | 'description' | 'publicLatitude' | 'publicLongitude' | 'exactLatitude' | 'exactLongitude'>, tasks: CareTask[]): DemoState {
    const next = structuredClone(state);
    const id = uid('spot');
    const routineId = uid('routine');
    const nextCareAt = new Date(new Date().setHours(19, 0, 0, 0)).toISOString();
    next.spots.push({
      ...spot,
      id,
      status: 'dueSoon',
      distanceMeters: 80,
      catCountEstimate: 1,
      routineId,
      caretakerProfileId: currentProfileId,
      nextCareAt,
    });
    next.routines.push({ id: routineId, spotId: id, label: 'Dinner', tasks, localTime: '19:00' });
    next.shifts.push({ id: uid('shift'), spotId: id, startsAt: nextCareAt, tasks, status: 'open', source: 'routine' });
    next.cats.push({
      id: uid('cat'),
      spotId: id,
      name: 'Local regular',
      coatColor: 'Unknown coat',
      breed: 'Domestic shorthair',
      notes: 'Add more details after a few care logs.',
    });
    write(next);
    return next;
  },
};
