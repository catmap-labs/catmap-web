import { CareLog, CareTask, DemoState, Spot } from '../../types/domain';

export interface CatmapRepository {
  load(): DemoState;
  save(state: DemoState): void;
  takeShift(state: DemoState, shiftId: string): DemoState;
  completeCare(state: DemoState, payload: Omit<CareLog, 'id' | 'profileId' | 'caredAt'>): DemoState;
  createHandoff(state: DemoState, spotId: string, fromDate: string, untilDate: string, tasks: CareTask[], message: string): DemoState;
  createSpot(
    state: DemoState,
    spot: Pick<Spot, 'name' | 'description' | 'countryCode' | 'city' | 'district' | 'neighborhood' | 'publicLatitude' | 'publicLongitude' | 'exactLatitude' | 'exactLongitude'>,
    tasks: CareTask[],
  ): DemoState;
}
