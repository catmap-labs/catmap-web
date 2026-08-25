import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, Map, MapLayerMouseEvent } from 'maplibre-gl';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Droplets,
  HandHeart,
  Home,
  ListChecks,
  LocateFixed,
  MapPin,
  Plus,
  Sparkles,
  UserRound,
  Utensils,
  Waves,
  X,
} from 'lucide-react';
import { en } from './i18n/en';
import { demoRepository } from './services/data/demoRepository';
import { currentProfileId } from './services/data/demoData';
import { CareTask, DemoState, Shift, Spot } from './types/domain';

type Tab = 'map' | 'care' | 'myCare';
type Sheet = 'nearby' | 'spot' | 'careNow' | 'away' | 'createSpot';

const taskIcon = {
  food: Utensils,
  water: Droplets,
  cleanup: Sparkles,
  catCheck: Check,
};

const statusClass = {
  caredToday: 'success',
  dueSoon: 'warning',
  needsSomeone: 'danger',
};

const statusRank = {
  needsSomeone: 0,
  dueSoon: 1,
  caredToday: 2,
};

const statusScore = {
  caredToday: 0,
  dueSoon: 1,
  needsSomeone: 2,
};

const statusColor = {
  caredToday: '#5f7c69',
  dueSoon: '#d6944a',
  needsSomeone: '#c85f50',
};

const formatTime = (iso: string) => new Intl.DateTimeFormat('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const formatDate = (iso: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(iso));
const dateInput = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const getSpot = (state: DemoState, spotId: string) => state.spots.find((spot) => spot.id === spotId);
const taskLabel = (task: CareTask) => en.task[task];

const createCatIconImage = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#ffffff';
  context.beginPath();
  context.moveTo(18, 24);
  context.lineTo(20, 11);
  context.lineTo(31, 22);
  context.lineTo(44, 11);
  context.lineTo(46, 24);
  context.quadraticCurveTo(53, 30, 53, 40);
  context.quadraticCurveTo(53, 55, 32, 55);
  context.quadraticCurveTo(11, 55, 11, 40);
  context.quadraticCurveTo(11, 30, 18, 24);
  context.closePath();
  context.fill();

  context.fillStyle = '#1f2a24';
  context.beginPath();
  context.arc(24, 38, 2.8, 0, Math.PI * 2);
  context.arc(40, 38, 2.8, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#1f2a24';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(32, 42);
  context.lineTo(32, 45);
  context.moveTo(25, 47);
  context.quadraticCurveTo(32, 51, 39, 47);
  context.stroke();

  return context.getImageData(0, 0, 64, 64);
};

function AppMap({
  spots,
  selectedSpotId,
  onSelect,
  onReady,
}: {
  spots: Spot[];
  selectedSpotId?: string;
  onSelect: (spotId: string) => void;
  onReady: (map: Map) => void;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const clickRef = useRef(onSelect);

  useEffect(() => {
    clickRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [127.111, 37.395],
      zoom: 14.3,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;
    onReady(map);

    map.on('load', () => {
      const catIcon = createCatIconImage();
      if (catIcon && !map.hasImage('cat-spot')) {
        map.addImage('cat-spot', catIcon);
      }

      map.addSource('spots', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 13,
        clusterProperties: {
          maxStatus: ['max', ['get', 'statusScore']],
        },
      });

      map.addLayer({
        id: 'spot-clusters',
        type: 'circle',
        source: 'spots',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'case',
            ['>=', ['get', 'maxStatus'], 2],
            statusColor.needsSomeone,
            ['>=', ['get', 'maxStatus'], 1],
            statusColor.dueSoon,
            statusColor.caredToday,
          ],
          'circle-radius': ['step', ['get', 'point_count'], 21, 4, 25, 8, 30],
          'circle-stroke-width': 4,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.96,
        },
      });

      map.addLayer({
        id: 'spot-cluster-count',
        type: 'symbol',
        source: 'spots',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold'],
          'text-size': 13,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'spot-points',
        type: 'circle',
        source: 'spots',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 19, 15],
          'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 5, 3],
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.96,
        },
      });

      map.addLayer({
        id: 'spot-cat-icons',
        type: 'symbol',
        source: 'spots',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'cat-spot',
          'icon-size': ['case', ['boolean', ['get', 'selected'], false], 0.32, 0.25],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      map.on('click', 'spot-points', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === 'string') clickRef.current(id);
      });

      map.on('click', 'spot-clusters', (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const coordinates = feature?.geometry.type === 'Point' ? feature.geometry.coordinates : undefined;
        const source = map.getSource('spots') as GeoJSONSource | undefined;
        if (!source || typeof clusterId !== 'number' || !coordinates) return;
        void source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center: [coordinates[0], coordinates[1]], zoom });
        });
      });

      for (const layerId of ['spot-points', 'spot-clusters']) {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    });

    navigator.geolocation?.getCurrentPosition(
      (position) => map.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14, speed: 0.8 }),
      () => undefined,
      { timeout: 4500, maximumAge: 300000 },
    );

    return () => map.remove();
  }, [onReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setSpotData = () => {
      const source = map.getSource('spots') as GeoJSONSource | undefined;
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: spots.map((spot) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [spot.publicLongitude, spot.publicLatitude],
          },
          properties: {
            id: spot.id,
            name: spot.name,
            status: spot.status,
            statusScore: statusScore[spot.status],
            color: statusColor[spot.status],
            selected: selectedSpotId === spot.id,
          },
        })),
      });
    };
    if (map.isStyleLoaded() && map.getSource('spots')) {
      setSpotData();
      return;
    }
    map.once('load', setSpotData);
  }, [spots, selectedSpotId]);

  return <div className="map-canvas" ref={mapNode} aria-label="Catmap public spot map" />;
}

function Badge({ status }: { status: Spot['status'] }) {
  return <span className={`badge ${statusClass[status]}`}>{en.status[status]}</span>;
}

function TaskChips({ tasks }: { tasks: CareTask[] }) {
  return (
    <div className="chip-row">
      {tasks.map((task) => {
        const Icon = taskIcon[task];
        return (
          <span className="task-chip" key={task}>
            <Icon size={14} />
            {taskLabel(task)}
          </span>
        );
      })}
    </div>
  );
}

function SheetShell({
  children,
  title,
  eyebrow,
  onBack,
  onClose,
  defaultExpanded = true,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  onClose?: () => void;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const dragStartY = useRef<number | null>(null);
  const didDrag = useRef(false);
  const toggleSheet = () => setIsExpanded((current) => !current);
  const finishDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const deltaY = clientY - dragStartY.current;
    dragStartY.current = null;
    if (deltaY > 42) {
      didDrag.current = true;
      setIsExpanded(false);
      return;
    }
    if (deltaY < -42) {
      didDrag.current = true;
      setIsExpanded(true);
    }
  };

  return (
    <section className={`sheet ${isExpanded ? 'expanded' : 'collapsed'}`} aria-label={title}>
      <button
        className="handle-button"
        aria-label={isExpanded ? 'Collapse sheet' : 'Expand sheet'}
        onClick={() => {
          if (didDrag.current) {
            didDrag.current = false;
            return;
          }
          toggleSheet();
        }}
        onPointerDown={(event) => {
          dragStartY.current = event.clientY;
        }}
        onPointerUp={(event) => finishDrag(event.clientY)}
        onPointerCancel={() => {
          dragStartY.current = null;
        }}
      >
        <span className="handle" />
      </button>
      <div className="sheet-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
        <div className="sheet-actions">
          {onBack && (
            <button className="icon-button subtle" aria-label="Back" onClick={onBack}>
              <ChevronLeft size={20} />
            </button>
          )}
          {onClose && (
            <button className="icon-button subtle" aria-label="Close sheet" onClick={onClose}>
              <X size={19} />
            </button>
          )}
        </div>
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

function SpotCard({ spot, shift, onOpen, onTake }: { spot: Spot; shift?: Shift; onOpen: () => void; onTake: () => void }) {
  return (
    <article className="care-card featured" onClick={onOpen}>
      <div className="spot-photo" aria-hidden="true" />
      <div className="care-card-body">
        <div className="card-topline">
          <Badge status={spot.status} />
          <span className="distance">{spot.distanceMeters} m</span>
        </div>
        <h2>{spot.name}</h2>
        <p>{formatTime(spot.nextCareAt)} · {shift ? shift.tasks.map(taskLabel).join(' + ') : 'Routine care'}</p>
        <div className="care-meta">
          <span>{spot.lastCaredAt ? `Last cared ${formatDate(spot.lastCaredAt)}` : 'No recent care'}</span>
          <span>{spot.catCountEstimate} cats seen</span>
        </div>
        <button
          className="primary"
          disabled={!shift || shift.status !== 'open'}
          onClick={(event) => {
            event.stopPropagation();
            onTake();
          }}
        >
          {shift?.status === 'assigned' ? 'Covered by Alex' : en.actions.takeIt}
        </button>
      </div>
    </article>
  );
}

function NearbySheet({ state, onOpenSpot, onTake, onQuickCare, onAway }: { state: DemoState; onOpenSpot: (id: string) => void; onTake: (id: string) => void; onQuickCare: () => void; onAway: () => void }) {
  const needsCare = [...state.spots].sort((a, b) => statusRank[a.status] - statusRank[b.status]);
  const featured = needsCare[0];
  const shift = state.shifts.find((item) => item.spotId === featured.id && item.status === 'open');
  const count = state.spots.filter((spot) => spot.status !== 'caredToday').length;
  return (
    <SheetShell title="Nearby care" eyebrow="Tonight" defaultExpanded={false}>
      <div className="status-strip">
        <span className="dot danger" />
        <strong>{count} spots need care</strong>
        <span>nearby</span>
      </div>
      <SpotCard spot={featured} shift={shift} onOpen={() => onOpenSpot(featured.id)} onTake={() => shift && onTake(shift.id)} />
      <div className="quick-grid">
        <button className="quick-card" onClick={onQuickCare}>
          <span className="quick-icon"><ClipboardCheck size={18} /></span>
          <span><strong>{en.actions.careNow}</strong><small>Log a visit</small></span>
        </button>
        <button className="quick-card" onClick={onAway}>
          <span className="quick-icon"><CalendarDays size={18} /></span>
          <span><strong>{en.actions.imAway}</strong><small>Find coverage</small></span>
        </button>
      </div>
    </SheetShell>
  );
}

function SpotDetail({ state, spot, onCare, onTake, onAway, onBack, onClose }: { state: DemoState; spot: Spot; onCare: () => void; onTake: (shiftId: string) => void; onAway: () => void; onBack: () => void; onClose: () => void }) {
  const logs = state.careLogs.filter((log) => log.spotId === spot.id).slice(0, 3);
  const shift = state.shifts.find((item) => item.spotId === spot.id && item.status === 'open');
  const routine = state.routines.find((item) => item.id === spot.routineId);
  const cats = state.cats.filter((cat) => cat.spotId === spot.id);
  return (
    <SheetShell title={spot.name} eyebrow="Spot detail" onBack={onBack} onClose={onClose}>
      <div className="detail-status">
        <Badge status={spot.status} />
        <p>{spot.description}</p>
      </div>
      <div className="info-grid">
        <div><span>Last cared for</span><strong>{spot.lastCaredAt ? `${formatTime(spot.lastCaredAt)} · ${spot.lastCaredBy}` : 'No log yet'}</strong></div>
        <div><span>Next care</span><strong>{formatTime(spot.nextCareAt)}</strong></div>
      </div>
      {routine && <TaskChips tasks={routine.tasks} />}
      <div className="cat-list">
        <h3>Cats usually seen</h3>
        {cats.map((cat) => (
          <article className="cat-row" key={cat.id}>
            <span className="cat-token" aria-hidden="true" />
            <div>
              <strong>{cat.name ?? 'Community cat'}</strong>
              <small>{cat.coatColor}{cat.breed ? ` · ${cat.breed}` : ''}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="log-list">
        <h3>Recent care log</h3>
        {logs.map((log) => (
          <div className="log-row" key={log.id}>
            <span>{formatTime(log.caredAt)}</span>
            <strong>{log.tasks.map(taskLabel).join(' · ')}</strong>
          </div>
        ))}
      </div>
      <div className="action-row">
        <button className="primary" onClick={onCare}>{en.actions.careNow}</button>
        <button className="secondary" disabled={!shift} onClick={() => shift && onTake(shift.id)}>{shift ? en.actions.takeIt : 'No open shift'}</button>
        <button className="secondary" onClick={onAway}>{en.actions.imAway}</button>
      </div>
    </SheetShell>
  );
}

function CareNow({ spot, onComplete, onBack, onClose }: { spot: Spot; onComplete: (tasks: CareTask[], catsSeen: number, foodAmount: 'small' | 'medium' | 'large', cleanupConfirmed: boolean, note: string) => void; onBack: () => void; onClose: () => void }) {
  const [tasks, setTasks] = useState<CareTask[]>(['food', 'water']);
  const [foodAmount, setFoodAmount] = useState<'small' | 'medium' | 'large'>('medium');
  const [catsSeen, setCatsSeen] = useState(spot.catCountEstimate);
  const [cleanupConfirmed, setCleanupConfirmed] = useState(false);
  const [note, setNote] = useState('');
  const toggle = (task: CareTask) => setTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  return (
    <SheetShell title="What did you do?" eyebrow={spot.name} onBack={onBack} onClose={onClose}>
      <div className="large-options">
        {(['food', 'water', 'cleanup', 'catCheck'] as CareTask[]).map((task) => {
          const Icon = taskIcon[task];
          return (
            <button className={tasks.includes(task) ? 'selected' : ''} key={task} onClick={() => toggle(task)}>
              <Icon size={20} />
              {taskLabel(task)}
            </button>
          );
        })}
      </div>
      <div className="segmented" aria-label="Food amount">
        {(['small', 'medium', 'large'] as const).map((amount) => (
          <button className={foodAmount === amount ? 'active' : ''} key={amount} onClick={() => setFoodAmount(amount)}>{amount}</button>
        ))}
      </div>
      <label className="field compact">
        Cats seen
        <input type="number" min="0" value={catsSeen} onChange={(event) => setCatsSeen(Number(event.target.value))} />
      </label>
      <label className="checkline">
        <input type="checkbox" checked={cleanupConfirmed} onChange={(event) => setCleanupConfirmed(event.target.checked)} />
        Cleanup confirmed
      </label>
      <label className="field">
        Note
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional short note" />
      </label>
      <button className="primary sticky-action" disabled={tasks.length === 0} onClick={() => onComplete(tasks, catsSeen, foodAmount, cleanupConfirmed, note)}>
        {en.actions.completeCare}
      </button>
    </SheetShell>
  );
}

function AwaySheet({ spot, onSubmit, onBack, onClose }: { spot: Spot; onSubmit: (from: string, until: string, tasks: CareTask[], message: string) => void; onBack: () => void; onClose: () => void }) {
  const [from, setFrom] = useState(dateInput(2));
  const [until, setUntil] = useState(dateInput(7));
  const [tasks, setTasks] = useState<CareTask[]>(['food', 'water']);
  const [message, setMessage] = useState("I'll be away for a few days. Can someone help with this spot?");
  const toggle = (task: CareTask) => setTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  return (
    <SheetShell title="I'm away" eyebrow={spot.name} onBack={onBack} onClose={onClose}>
      <div className="two-fields">
        <label className="field">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="field">Until<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
      </div>
      <div className="large-options compact-options">
        {(['food', 'water', 'cleanup', 'catCheck'] as CareTask[]).map((task) => (
          <button className={tasks.includes(task) ? 'selected' : ''} key={task} onClick={() => toggle(task)}>{taskLabel(task)}</button>
        ))}
      </div>
      <label className="field">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      <button className="primary sticky-action" disabled={!from || !until || tasks.length === 0} onClick={() => onSubmit(from, until, tasks, message)}>
        {en.actions.askCoverage}
      </button>
    </SheetShell>
  );
}

function CareBoard({ state, onTake, onOpenSpot }: { state: DemoState; onTake: (shiftId: string) => void; onOpenSpot: (spotId: string) => void }) {
  const ordered = [...state.shifts].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return (
    <main className="panel-page">
      <header className="page-head">
        <p className="eyebrow">{en.demoMode}</p>
        <h1>Care</h1>
      </header>
      <section className="list-section">
        <h2>Needs someone</h2>
        {ordered.filter((shift) => shift.status === 'open').map((shift) => {
          const spot = getSpot(state, shift.spotId);
          if (!spot) return null;
          return (
            <article className="shift-card" key={shift.id} onClick={() => onOpenSpot(spot.id)}>
              <div>
                <span className="time">{formatTime(shift.startsAt)}</span>
                <h3>{spot.name}</h3>
                <TaskChips tasks={shift.tasks} />
              </div>
              <div className="shift-side">
                <span>{spot.distanceMeters} m</span>
                <button className="secondary compact" onClick={(event) => { event.stopPropagation(); onTake(shift.id); }}>{en.actions.takeIt}</button>
              </div>
            </article>
          );
        })}
      </section>
      <CoverageBoard state={state} onTake={onTake} />
    </main>
  );
}

function CoverageBoard({ state, onTake }: { state: DemoState; onTake: (shiftId: string) => void }) {
  if (state.handoffRequests.length === 0) {
    return (
      <section className="empty-state">
        <CalendarDays size={22} />
        <h2>No handoffs yet</h2>
        <p>Create an away request from a spot to see coverable shifts here.</p>
      </section>
    );
  }
  return (
    <section className="list-section">
      <h2>Coverage requests</h2>
      {state.handoffRequests.map((request) => {
        const spot = getSpot(state, request.spotId);
        const shifts = request.shiftIds.map((id) => state.shifts.find((shift) => shift.id === id)).filter(Boolean) as Shift[];
        const open = shifts.filter((shift) => shift.status === 'open');
        return (
          <article className="handoff-card" key={request.id}>
            <div className="card-topline">
              <h3>{spot?.name}</h3>
              <span>{formatDate(`${request.fromDate}T00:00:00`)} - {formatDate(`${request.untilDate}T00:00:00`)}</span>
            </div>
            <p>{request.message}</p>
            <div className="coverage-grid">
              {shifts.map((shift) => (
                <button key={shift.id} className={shift.status === 'open' ? '' : 'covered'} disabled={shift.status !== 'open'} onClick={() => onTake(shift.id)}>
                  <strong>{formatDate(shift.startsAt)}</strong>
                  <span>{shift.status === 'open' ? 'Needs help' : 'Covered by Alex'}</span>
                </button>
              ))}
            </div>
            <button className="secondary" disabled={open.length === 0} onClick={() => open.forEach((shift) => onTake(shift.id))}>{en.actions.coverAll}</button>
          </article>
        );
      })}
    </section>
  );
}

function MyCare({ state, onOpenSpot }: { state: DemoState; onOpenSpot: (spotId: string) => void }) {
  const mine = state.shifts.filter((shift) => shift.assignedToProfileId === currentProfileId && shift.status !== 'completed');
  const mySpots = state.spots.filter((spot) => spot.caretakerProfileId === currentProfileId);
  return (
    <main className="panel-page">
      <header className="page-head">
        <p className="eyebrow">Alex</p>
        <h1>My Care</h1>
      </header>
      <section className="list-section">
        <h2>Upcoming</h2>
        {mine.length === 0 ? <p className="muted">No assigned care yet.</p> : mine.map((shift) => {
          const spot = getSpot(state, shift.spotId);
          if (!spot) return null;
          return (
            <article className="mini-row" key={shift.id} onClick={() => onOpenSpot(spot.id)}>
              <span>{formatTime(shift.startsAt)}</span>
              <div><strong>{spot.name}</strong><small>{shift.tasks.map(taskLabel).join(' · ')}</small></div>
            </article>
          );
        })}
      </section>
      <section className="list-section">
        <h2>My spots</h2>
        {mySpots.map((spot) => <button className="plain-row" key={spot.id} onClick={() => onOpenSpot(spot.id)}>{spot.name}<Badge status={spot.status} /></button>)}
      </section>
      <section className="list-section three-tabs" aria-label="Care summaries">
        <button>My spots</button>
        <button>My handoffs</button>
        <button>Care history</button>
      </section>
    </main>
  );
}

function CreateSpot({ center, onCreate, onBack, onClose }: { center: [number, number]; onCreate: (name: string, description: string, tasks: CareTask[]) => void; onBack: () => void; onClose: () => void }) {
  const [name, setName] = useState('Courtyard corner');
  const [description, setDescription] = useState('Approximate public marker. Exact location stays private.');
  const [tasks, setTasks] = useState<CareTask[]>(['food', 'water']);
  const toggle = (task: CareTask) => setTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  return (
    <SheetShell title="New spot" eyebrow="Pick from current map center" onBack={onBack} onClose={onClose}>
      <div className="privacy-note"><MapPin size={18} /> Public marker uses an approximate location. Exact coordinates are stored separately for future caretaker-only access.</div>
      <label className="field">Spot name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="large-options compact-options">
        {(['food', 'water', 'cleanup', 'catCheck'] as CareTask[]).map((task) => (
          <button className={tasks.includes(task) ? 'selected' : ''} key={task} onClick={() => toggle(task)}>{taskLabel(task)}</button>
        ))}
      </div>
      <p className="muted small">Map center: {center[1].toFixed(4)}, {center[0].toFixed(4)}</p>
      <button className="primary sticky-action" disabled={!name.trim() || tasks.length === 0} onClick={() => onCreate(name, description, tasks)}>{en.actions.saveSpot}</button>
    </SheetShell>
  );
}

export function App() {
  const [state, setState] = useState<DemoState>(() => demoRepository.load());
  const [tab, setTab] = useState<Tab>('map');
  const [sheet, setSheet] = useState<Sheet>('nearby');
  const [selectedSpotId, setSelectedSpotId] = useState(state.spots[0]?.id);
  const [toast, setToast] = useState('');
  const [map, setMap] = useState<Map | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([127.111, 37.395]);
  const selectedSpot = useMemo(() => state.spots.find((spot) => spot.id === selectedSpotId) ?? state.spots[0], [state.spots, selectedSpotId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!map) return;
    const onMove = () => {
      const center = map.getCenter();
      setMapCenter([center.lng, center.lat]);
    };
    map.on('moveend', onMove);
    return () => { map.off('moveend', onMove); };
  }, [map]);

  const save = (next: DemoState, message: string) => {
    setState(next);
    setToast(message);
  };
  const openSpot = (spotId: string) => {
    setSelectedSpotId(spotId);
    setTab('map');
    setSheet('spot');
    const spot = state.spots.find((item) => item.id === spotId);
    if (spot && map) map.flyTo({ center: [spot.publicLongitude, spot.publicLatitude], zoom: 15, speed: 0.8 });
  };
  const takeShift = (shiftId: string) => save(demoRepository.takeShift(state, shiftId), 'Care shift added to My Care.');
  const closeSheet = () => setSheet('nearby');

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Seoul · Bundang · {en.demoMode}</p>
          <div className="brand-row"><div className="brand-mark">C</div><div><strong>{en.appName}</strong><span>{en.tagline}</span></div></div>
        </div>
        <button className="icon-button" aria-label="Profile"><UserRound size={19} /></button>
      </div>

      {tab === 'map' ? (
        <>
          <AppMap spots={state.spots} selectedSpotId={selectedSpot?.id} onReady={setMap} onSelect={openSpot} />
          <div className="map-controls">
            <button className="floating" aria-label="Use current location" onClick={() => navigator.geolocation?.getCurrentPosition((pos) => map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14.5 }))}><LocateFixed size={20} /></button>
            <button className="floating" aria-label="Create spot" onClick={() => setSheet('createSpot')}><Plus size={22} /></button>
          </div>
          {sheet === 'nearby' && <NearbySheet state={state} onOpenSpot={openSpot} onTake={takeShift} onQuickCare={() => setSheet('careNow')} onAway={() => setSheet('away')} />}
          {sheet === 'spot' && selectedSpot && <SpotDetail state={state} spot={selectedSpot} onCare={() => setSheet('careNow')} onTake={takeShift} onAway={() => setSheet('away')} onBack={() => setSheet('nearby')} onClose={closeSheet} />}
          {sheet === 'careNow' && selectedSpot && (
            <CareNow
              spot={selectedSpot}
              onBack={() => setSheet('spot')}
              onClose={closeSheet}
              onComplete={(tasks, catsSeen, foodAmount, cleanupConfirmed, note) => {
                save(demoRepository.completeCare(state, { spotId: selectedSpot.id, tasks, catsSeen, foodAmount, cleanupConfirmed, note }), 'Care logged. This spot is cared today.');
                setSheet('spot');
              }}
            />
          )}
          {sheet === 'away' && selectedSpot && (
            <AwaySheet
              spot={selectedSpot}
              onBack={() => setSheet('spot')}
              onClose={closeSheet}
              onSubmit={(from, until, tasks, message) => {
                save(demoRepository.createHandoff(state, selectedSpot.id, from, until, tasks, message), 'Coverage request created.');
                setTab('care');
              }}
            />
          )}
          {sheet === 'createSpot' && (
            <CreateSpot
              center={mapCenter}
              onBack={() => setSheet('nearby')}
              onClose={closeSheet}
              onCreate={(name, description, tasks) => {
                save(
                  demoRepository.createSpot(
                    state,
                    {
                      name,
                      description,
                      publicLongitude: mapCenter[0],
                      publicLatitude: mapCenter[1],
                      exactLongitude: mapCenter[0] + 0.0007,
                      exactLatitude: mapCenter[1] - 0.0006,
                    },
                    tasks,
                  ),
                  'New care spot created.',
                );
                setSheet('nearby');
              }}
            />
          )}
        </>
      ) : tab === 'care' ? (
        <CareBoard state={state} onTake={takeShift} onOpenSpot={openSpot} />
      ) : (
        <MyCare state={state} onOpenSpot={openSpot} />
      )}

      <nav className="bottom-nav" aria-label="Primary">
        <button className={tab === 'map' ? 'active' : ''} onClick={() => { setTab('map'); setSheet('nearby'); }}><Home size={20} /><small>{en.nav.map}</small></button>
        <button className={tab === 'care' ? 'active' : ''} onClick={() => setTab('care')}><ListChecks size={20} /><small>{en.nav.care}</small></button>
        <button className="create" aria-label={en.actions.createSpot} onClick={() => { setTab('map'); setSheet('createSpot'); }}><Plus size={27} /></button>
        <button className={tab === 'myCare' ? 'active' : ''} onClick={() => setTab('myCare')}><HandHeart size={20} /><small>{en.nav.myCare}</small></button>
        <button onClick={() => { setTab('map'); setSheet('nearby'); }}><Waves size={20} /><small>Nearby</small></button>
      </nav>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><X size={14} /></button></div>}
    </div>
  );
}
