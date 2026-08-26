import {
  Assignment,
  CareLog,
  CatProfile,
  DemoState,
  HandoffRequest,
  Profile,
  Routine,
  Shift,
  Spot,
  SpotMember,
} from '../../types/domain';

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryCatmapDb {
  profiles: Profile[];
  spots: Spot[];
  cats: CatProfile[];
  members: SpotMember[];
  routines: Routine[];
  shifts: Shift[];
  assignments: Assignment[];
  careLogs: CareLog[];
  handoffRequests: HandoffRequest[];

  constructor(seed: DemoState) {
    this.profiles = clone(seed.profiles);
    this.spots = clone(seed.spots);
    this.cats = clone(seed.cats);
    this.members = clone(seed.members);
    this.routines = clone(seed.routines);
    this.shifts = clone(seed.shifts);
    this.assignments = clone(seed.assignments);
    this.careLogs = clone(seed.careLogs);
    this.handoffRequests = clone(seed.handoffRequests);
  }

  snapshot(): DemoState {
    return {
      profiles: clone(this.profiles),
      spots: clone(this.spots),
      cats: clone(this.cats),
      members: clone(this.members),
      routines: clone(this.routines),
      shifts: clone(this.shifts),
      assignments: clone(this.assignments),
      careLogs: clone(this.careLogs),
      handoffRequests: clone(this.handoffRequests),
    };
  }
}

export const createMemoryDb = (seed: DemoState) => new MemoryCatmapDb(seed);
