import { currentProfileId, createDemoState } from './demoData';
import { CatmapRepository } from './catmapRepository';
import { createMemoryDb } from './memoryDb';
import { CareLog, CareTask, DemoState, HandoffRequest, Spot } from '../../types/domain';

const storageKey = 'catmap-demo-state-v1';

const mergeById = <T extends { id: string }>(fallback: T[], stored?: T[]) => {
  const merged = new Map(fallback.map((item) => [item.id, item]));
  stored?.forEach((item) => {
    const base = merged.get(item.id);
    merged.set(item.id, base ? { ...base, ...item } : item);
  });
  return [...merged.values()];
};

const read = (): DemoState => {
  const fallback = createDemoState();
  const raw = localStorage.getItem(storageKey);
  if (!raw) return fallback;
  try {
    const stored = JSON.parse(raw) as Partial<DemoState>;
    const merged = {
      ...fallback,
      ...stored,
      profiles: mergeById(fallback.profiles, stored.profiles),
      spots: mergeById(fallback.spots, stored.spots),
      cats: mergeById(fallback.cats, stored.cats),
      members: mergeById(fallback.members, stored.members),
      routines: mergeById(fallback.routines, stored.routines),
      shifts: mergeById(fallback.shifts, stored.shifts),
      assignments: mergeById(fallback.assignments, stored.assignments),
      careLogs: mergeById(fallback.careLogs, stored.careLogs),
      handoffRequests: mergeById(fallback.handoffRequests, stored.handoffRequests),
    };
    return createMemoryDb(merged).snapshot();
  } catch {
    return fallback;
  }
};

const write = (state: DemoState) => localStorage.setItem(storageKey, JSON.stringify(state));

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayDoneStatus = 'caredToday' as const;

export const demoRepository: CatmapRepository = {
  load(): DemoState {
    const state = read();
    write(state);
    return state;
  },
  save(state: DemoState) {
    write(state);
  },
  takeShift(state: DemoState, shiftId: string): DemoState {
    const db = createMemoryDb(state);
    const shift = db.shifts.find((item) => item.id === shiftId);
    if (shift && shift.status !== 'completed') {
      shift.status = 'assigned';
      shift.assignedToProfileId = currentProfileId;
      db.assignments.push({ id: uid('assignment'), shiftId, profileId: currentProfileId, acceptedAt: new Date().toISOString() });
    }
    const next = db.snapshot();
    write(next);
    return next;
  },
  completeCare(state: DemoState, payload: Omit<CareLog, 'id' | 'profileId' | 'caredAt'>): DemoState {
    const db = createMemoryDb(state);
    const caredAt = new Date().toISOString();
    db.careLogs.unshift({ ...payload, id: uid('log'), profileId: currentProfileId, caredAt });
    const spot = db.spots.find((item) => item.id === payload.spotId);
    if (spot) {
      spot.status = todayDoneStatus;
      spot.lastCaredAt = caredAt;
      spot.lastCaredBy = 'Alex';
    }
    db.shifts
      .filter((shift) => shift.spotId === payload.spotId && shift.status !== 'completed')
      .forEach((shift) => {
        shift.status = 'completed';
        shift.assignedToProfileId = currentProfileId;
      });
    const next = db.snapshot();
    write(next);
    return next;
  },
  createHandoff(state: DemoState, spotId: string, fromDate: string, untilDate: string, tasks: CareTask[], message: string): DemoState {
    const db = createMemoryDb(state);
    const shiftIds: string[] = [];
    const start = new Date(`${fromDate}T19:00:00`);
    const end = new Date(`${untilDate}T19:00:00`);
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const id = uid('shift-handoff');
      shiftIds.push(id);
      db.shifts.push({
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
    db.handoffRequests.unshift(request);
    const next = db.snapshot();
    write(next);
    return next;
  },
  createSpot(state: DemoState, spot: Pick<Spot, 'name' | 'description' | 'countryCode' | 'city' | 'district' | 'neighborhood' | 'publicLatitude' | 'publicLongitude' | 'exactLatitude' | 'exactLongitude'>, tasks: CareTask[]): DemoState {
    const db = createMemoryDb(state);
    const id = uid('spot');
    const routineId = uid('routine');
    const nextCareAt = new Date(new Date().setHours(19, 0, 0, 0)).toISOString();
    db.spots.push({
      ...spot,
      id,
      status: 'dueSoon',
      distanceMeters: 80,
      catCountEstimate: 1,
      routineId,
      caretakerProfileId: currentProfileId,
      nextCareAt,
    });
    db.routines.push({ id: routineId, spotId: id, label: 'Dinner', tasks, localTime: '19:00' });
    db.shifts.push({ id: uid('shift'), spotId: id, startsAt: nextCareAt, tasks, status: 'open', source: 'routine' });
    db.cats.push({
      id: uid('cat'),
      spotId: id,
      name: 'Local regular',
      coatColor: 'Unknown coat',
      breed: 'Domestic shorthair',
      notes: 'Add more details after a few care logs.',
    });
    const next = db.snapshot();
    write(next);
    return next;
  },
};
