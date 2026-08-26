import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Minus,
  Plus,
  Search,
  Settings,
  Sparkles,
  Utensils,
  Waves,
  X,
} from 'lucide-react';
import { en } from './i18n/en';
import { ko } from './i18n/ko';
import { demoRepository } from './services/data/demoRepository';
import { currentProfileId } from './services/data/demoData';
import { CareTask, DemoState, Shift, Spot } from './types/domain';

type Tab = 'map' | 'care' | 'myCare';
type Sheet = 'nearby' | 'spot' | 'careNow' | 'away' | 'createSpot' | 'settings';
type Locale = 'ko' | 'en';

const messages = { ko, en };
type Messages = (typeof messages)[Locale];
const localeStorageKey = 'catmap-locale-v1';
const mapProvider = import.meta.env.VITE_MAP_PROVIDER ?? 'maplibre';
const demoAddressIndex = [
  { label: '서울', aliases: ['seoul', '서울', '서울시'], center: [126.978, 37.5665] as [number, number], zoom: 12 },
  { label: '분당', aliases: ['bundang', '분당', '성남 분당', '분당구'], center: [127.1189, 37.3827] as [number, number], zoom: 13 },
  { label: '판교', aliases: ['pangyo', '판교', '판교역'], center: [127.1115, 37.3948] as [number, number], zoom: 15 },
  { label: '정자', aliases: ['jeongja', '정자', '정자역'], center: [127.1089, 37.3671] as [number, number], zoom: 15 },
  { label: '수내', aliases: ['sunae', '수내', '수내역'], center: [127.1149, 37.3784] as [number, number], zoom: 15 },
  { label: '서현', aliases: ['seohyeon', '서현', '서현역'], center: [127.1233, 37.385] as [number, number], zoom: 15 },
];

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
const nearbyCareLimitMeters = 5000;

const formatTime = (iso: string) => new Intl.DateTimeFormat('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const formatDate = (iso: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(iso));
const dateInput = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const getSpot = (state: DemoState, spotId: string) => state.spots.find((spot) => spot.id === spotId);
const searchDemoAddress = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return undefined;
  return demoAddressIndex.find((item) => item.aliases.some((alias) => normalized.includes(alias)));
};
const localizedToast = (locale: Locale, koMessage: string, enMessage: string) => (locale === 'ko' ? koMessage : enMessage);

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

const createSelectedPinImage = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 88;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.shadowColor = 'rgba(31, 42, 36, 0.22)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 5;
  context.fillStyle = '#1f2a24';
  context.beginPath();
  context.moveTo(36, 80);
  context.bezierCurveTo(31, 67, 14, 52, 14, 32);
  context.bezierCurveTo(14, 18, 24, 8, 36, 8);
  context.bezierCurveTo(48, 8, 58, 18, 58, 32);
  context.bezierCurveTo(58, 52, 41, 67, 36, 80);
  context.closePath();
  context.fill();

  context.shadowColor = 'transparent';
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(36, 32, 13, 0, Math.PI * 2);
  context.fill();

  return context.getImageData(0, 0, 72, 88);
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
  const spotsRef = useRef(spots);
  const selectedSpotIdRef = useRef(selectedSpotId);

  const writeSpotSource = useCallback((targetMap: Map) => {
    const source = targetMap.getSource('spots') as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: spotsRef.current.map((spot) => ({
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
          selected: selectedSpotIdRef.current === spot.id,
        },
      })),
    });
  }, []);

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
      const selectedPin = createSelectedPinImage();
      if (selectedPin && !map.hasImage('selected-pin')) {
        map.addImage('selected-pin', selectedPin);
      }

      map.addSource('spots', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: true,
        clusterRadius: 180,
        clusterMaxZoom: 14,
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
          'circle-radius': ['step', ['get', 'point_count'], 22, 3, 27, 8, 32],
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

      map.addLayer({
        id: 'spot-selected-pin',
        type: 'symbol',
        source: 'spots',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
        layout: {
          'icon-image': 'selected-pin',
          'icon-size': 0.48,
          'icon-anchor': 'bottom',
          'icon-offset': [0, -16],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      writeSpotSource(map);

      const openSpotFromMap = (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === 'string') clickRef.current(id);
      };
      for (const layerId of ['spot-points', 'spot-cat-icons', 'spot-selected-pin']) {
        map.on('click', layerId, openSpotFromMap);
      }

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

      for (const layerId of ['spot-points', 'spot-cat-icons', 'spot-selected-pin', 'spot-clusters']) {
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
  }, [onReady, writeSpotSource]);

  useEffect(() => {
    spotsRef.current = spots;
    selectedSpotIdRef.current = selectedSpotId;
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded() && map.getSource('spots')) {
      writeSpotSource(map);
      return;
    }
    map.once('load', () => writeSpotSource(map));
  }, [spots, selectedSpotId, writeSpotSource]);

  return <div className="map-canvas" ref={mapNode} aria-label="Catmap public spot map" />;
}

function Badge({ status, t }: { status: Spot['status']; t: Messages }) {
  return <span className={`badge ${statusClass[status]}`}>{t.status[status]}</span>;
}

function TaskChips({ tasks, t }: { tasks: CareTask[]; t: Messages }) {
  return (
    <div className="chip-row">
      {tasks.map((task) => {
        const Icon = taskIcon[task];
        return (
          <span className="task-chip" key={task}>
            <Icon size={14} />
            {t.task[task]}
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

function BrandLogo() {
  return (
    <span className="brand-logo" aria-hidden="true">
      <svg viewBox="0 0 72 72" role="img">
        <path className="logo-pin" d="M36 66C31 54 16 42 16 27 16 14 25 7 36 7s20 7 20 20c0 15-15 27-20 39Z" />
        <path className="logo-face" d="M24 31c0-3 1-6 4-8l1-8 7 7 7-7 1 8c3 2 4 5 4 8 0 8-5 13-12 13s-12-5-12-13Z" />
        <circle cx="31" cy="31" r="1.8" />
        <circle cx="41" cy="31" r="1.8" />
        <path className="logo-mouth" d="M36 35v2m-5 2c3 3 7 3 10 0" />
      </svg>
    </span>
  );
}

function Wordmark() {
  return (
    <span className="wordmark" aria-label="Catmap">
      Cat<span>map</span>
    </span>
  );
}

function SpotCard({ spot, shift, onOpen, onTake, t }: { spot: Spot; shift?: Shift; onOpen: () => void; onTake: () => void; t: Messages }) {
  return (
    <article className="care-card featured" onClick={onOpen}>
      <div className="spot-photo" aria-hidden="true" />
      <div className="care-card-body">
        <div className="card-topline">
          <Badge status={spot.status} t={t} />
          <span className="distance">{spot.distanceMeters} m</span>
        </div>
        <h2>{spot.name}</h2>
        <p>{formatTime(spot.nextCareAt)} · {shift ? shift.tasks.map((task) => t.task[task]).join(' + ') : t.sheets.routineCare}</p>
        <div className="care-meta">
          <span>{spot.lastCaredAt ? `${t.sheets.lastCared} ${formatDate(spot.lastCaredAt)}` : t.sheets.noRecentCare}</span>
          <span>{spot.catCountEstimate} {t.sheets.catsSeen}</span>
        </div>
        <button
          className="primary"
          disabled={!shift || shift.status !== 'open'}
          onClick={(event) => {
            event.stopPropagation();
            onTake();
          }}
        >
          {shift?.status === 'assigned' ? t.sheets.coveredByAlex : t.actions.takeIt}
        </button>
      </div>
    </article>
  );
}

function NearbySheet({ state, onOpenSpot, onTake, onQuickCare, onAway, t }: { state: DemoState; onOpenSpot: (id: string) => void; onTake: (id: string) => void; onQuickCare: () => void; onAway: () => void; t: Messages }) {
  const needsCare = [...state.spots].sort((a, b) => statusRank[a.status] - statusRank[b.status]);
  const featured = needsCare[0];
  const shift = state.shifts.find((item) => item.spotId === featured.id && item.status === 'open');
  const count = state.spots.filter((spot) => spot.status !== 'caredToday').length;
  return (
    <SheetShell title={t.sheets.nearbyCare} eyebrow={t.sheets.tonight} defaultExpanded={false}>
      <div className="status-strip">
        <span className="dot danger" />
        <strong>{count} {t.sheets.spotsNeedCare}</strong>
        <span>{t.sheets.nearby}</span>
      </div>
      <SpotCard spot={featured} shift={shift} onOpen={() => onOpenSpot(featured.id)} onTake={() => shift && onTake(shift.id)} t={t} />
      <div className="quick-grid">
        <button className="quick-card" onClick={onQuickCare}>
          <span className="quick-icon"><ClipboardCheck size={18} /></span>
          <span><strong>{t.actions.careNow}</strong><small>{t.sheets.logVisit}</small></span>
        </button>
        <button className="quick-card" onClick={onAway}>
          <span className="quick-icon"><CalendarDays size={18} /></span>
          <span><strong>{t.actions.imAway}</strong><small>{t.sheets.findCoverage}</small></span>
        </button>
      </div>
    </SheetShell>
  );
}

function SpotDetail({ state, spot, onCare, onTake, onAway, onBack, onClose, t }: { state: DemoState; spot: Spot; onCare: () => void; onTake: (shiftId: string) => void; onAway: () => void; onBack: () => void; onClose: () => void; t: Messages }) {
  const logs = state.careLogs.filter((log) => log.spotId === spot.id).slice(0, 3);
  const shift = state.shifts.find((item) => item.spotId === spot.id && item.status === 'open');
  const routine = state.routines.find((item) => item.id === spot.routineId);
  const cats = state.cats.filter((cat) => cat.spotId === spot.id);
  return (
    <SheetShell title={spot.name} eyebrow={t.sheets.spotDetail} onBack={onBack} onClose={onClose}>
      <div className="detail-status">
        <Badge status={spot.status} t={t} />
        <p>{spot.description}</p>
      </div>
      <div className="info-grid">
        <div><span>{t.sheets.lastCaredFor}</span><strong>{spot.lastCaredAt ? `${formatTime(spot.lastCaredAt)} · ${spot.lastCaredBy}` : t.sheets.noLogYet}</strong></div>
        <div><span>{t.sheets.nextCare}</span><strong>{formatTime(spot.nextCareAt)}</strong></div>
      </div>
      {routine && <TaskChips tasks={routine.tasks} t={t} />}
      <div className="cat-list">
        <h3>{t.sheets.catsUsuallySeen}</h3>
        {cats.map((cat) => (
          <article className="cat-row" key={cat.id}>
            <span className="cat-token" aria-hidden="true" />
            <div>
              <strong>{cat.name ?? t.sheets.communityCat}</strong>
              <small>{cat.coatColor}{cat.breed ? ` · ${cat.breed}` : ''}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="log-list">
        <h3>{t.sheets.recentCareLog}</h3>
        {logs.map((log) => (
          <div className="log-row" key={log.id}>
            <span>{formatTime(log.caredAt)}</span>
            <strong>{log.tasks.map((task) => t.task[task]).join(' · ')}</strong>
          </div>
        ))}
      </div>
      <div className="action-row">
        <button className="primary" onClick={onCare}>{t.actions.careNow}</button>
        <button className="secondary" disabled={!shift} onClick={() => shift && onTake(shift.id)}>{shift ? t.actions.takeIt : t.sheets.noOpenShift}</button>
        <button className="secondary" onClick={onAway}>{t.actions.imAway}</button>
      </div>
    </SheetShell>
  );
}

function CareNow({ spot, onComplete, onBack, onClose, t }: { spot: Spot; onComplete: (tasks: CareTask[], catsSeen: number, foodAmount: 'small' | 'medium' | 'large', cleanupConfirmed: boolean, note: string) => void; onBack: () => void; onClose: () => void; t: Messages }) {
  const [tasks, setTasks] = useState<CareTask[]>(['food', 'water']);
  const [foodAmount, setFoodAmount] = useState<'small' | 'medium' | 'large'>('medium');
  const [catsSeen, setCatsSeen] = useState(spot.catCountEstimate);
  const [cleanupConfirmed, setCleanupConfirmed] = useState(false);
  const [note, setNote] = useState('');
  const toggle = (task: CareTask) => setTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  return (
    <SheetShell title={t.sheets.careQuestion} eyebrow={spot.name} onBack={onBack} onClose={onClose}>
      <div className="large-options">
        {(['food', 'water', 'cleanup', 'catCheck'] as CareTask[]).map((task) => {
          const Icon = taskIcon[task];
          return (
            <button className={tasks.includes(task) ? 'selected' : ''} key={task} onClick={() => toggle(task)}>
              <Icon size={20} />
              {t.task[task]}
            </button>
          );
        })}
      </div>
      <div className="segmented" aria-label={t.sheets.foodAmount}>
        {(['small', 'medium', 'large'] as const).map((amount) => (
          <button className={foodAmount === amount ? 'active' : ''} key={amount} onClick={() => setFoodAmount(amount)}>{t.sheets[amount]}</button>
        ))}
      </div>
      <label className="field compact">
        {t.sheets.catsSeenLabel}
        <input type="number" min="0" value={catsSeen} onChange={(event) => setCatsSeen(Number(event.target.value))} />
      </label>
      <label className="checkline">
        <input type="checkbox" checked={cleanupConfirmed} onChange={(event) => setCleanupConfirmed(event.target.checked)} />
        {t.sheets.cleanupConfirmed}
      </label>
      <label className="field">
        {t.sheets.note}
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t.sheets.optionalNote} />
      </label>
      <button className="primary sticky-action" disabled={tasks.length === 0} onClick={() => onComplete(tasks, catsSeen, foodAmount, cleanupConfirmed, note)}>
        {t.actions.completeCare}
      </button>
    </SheetShell>
  );
}

function AwaySheet({ spot, onSubmit, onBack, onClose, t }: { spot: Spot; onSubmit: (from: string, until: string, tasks: CareTask[], message: string) => void; onBack: () => void; onClose: () => void; t: Messages }) {
  const [from, setFrom] = useState(dateInput(2));
  const [until, setUntil] = useState(dateInput(7));
  const [tasks, setTasks] = useState<CareTask[]>(['food', 'water']);
  const [message, setMessage] = useState<string>(t.sheets.defaultAwayMessage);
  const toggle = (task: CareTask) => setTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  return (
    <SheetShell title={t.sheets.awayTitle} eyebrow={spot.name} onBack={onBack} onClose={onClose}>
      <div className="two-fields">
        <label className="field">{t.sheets.from}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="field">{t.sheets.until}<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
      </div>
      <div className="large-options compact-options">
        {(['food', 'water', 'cleanup', 'catCheck'] as CareTask[]).map((task) => (
          <button className={tasks.includes(task) ? 'selected' : ''} key={task} onClick={() => toggle(task)}>{t.task[task]}</button>
        ))}
      </div>
      <label className="field">{t.sheets.message}<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      <button className="primary sticky-action" disabled={!from || !until || tasks.length === 0} onClick={() => onSubmit(from, until, tasks, message)}>
        {t.actions.askCoverage}
      </button>
    </SheetShell>
  );
}

function CareBoard({ state, onTake, onOpenSpot, t }: { state: DemoState; onTake: (shiftId: string) => void; onOpenSpot: (spotId: string) => void; t: Messages }) {
  const ordered = [...state.shifts].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const nearbyOpenShifts = ordered
    .filter((shift) => shift.status === 'open')
    .map((shift) => ({ shift, spot: getSpot(state, shift.spotId) }))
    .filter((item): item is { shift: Shift; spot: Spot } => {
      if (!item.spot) return false;
      return item.spot.distanceMeters <= nearbyCareLimitMeters;
    });
  return (
    <main className="panel-page">
      <header className="page-head">
        <p className="eyebrow">{t.demoMode}</p>
        <h1>{t.nav.care}</h1>
      </header>
      <section className="list-section">
        <h2>{t.sheets.nearbyOpenCare}</h2>
        <p className="muted small">{t.sheets.globalSamplesHidden}</p>
        {nearbyOpenShifts.length === 0 ? <p className="muted">{t.sheets.noNearbyOpenCare}</p> : nearbyOpenShifts.map(({ shift, spot }) => {
          return (
            <article className="shift-card" key={shift.id} onClick={() => onOpenSpot(spot.id)}>
              <div>
                <span className="time">{formatTime(shift.startsAt)}</span>
                <h3>{spot.name}</h3>
                <TaskChips tasks={shift.tasks} t={t} />
              </div>
              <div className="shift-side">
                <span>{spot.distanceMeters} m</span>
                <button className="secondary compact" onClick={(event) => { event.stopPropagation(); onTake(shift.id); }}>{t.actions.takeIt}</button>
              </div>
            </article>
          );
        })}
      </section>
      <CoverageBoard state={state} onTake={onTake} t={t} />
    </main>
  );
}

function CoverageBoard({ state, onTake, t }: { state: DemoState; onTake: (shiftId: string) => void; t: Messages }) {
  if (state.handoffRequests.length === 0) {
    return (
      <section className="empty-state">
        <CalendarDays size={22} />
        <h2>{t.sheets.noHandoffsYet}</h2>
        <p>{t.sheets.handoffEmptyBody}</p>
      </section>
    );
  }
  return (
    <section className="list-section">
      <h2>{t.sheets.coverageRequests}</h2>
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
                  <span>{shift.status === 'open' ? t.sheets.needsHelp : t.sheets.coveredByAlex}</span>
                </button>
              ))}
            </div>
            <button className="secondary" disabled={open.length === 0} onClick={() => open.forEach((shift) => onTake(shift.id))}>{t.actions.coverAll}</button>
          </article>
        );
      })}
    </section>
  );
}

function MyCare({ state, onOpenSpot, t }: { state: DemoState; onOpenSpot: (spotId: string) => void; t: Messages }) {
  const mine = state.shifts.filter((shift) => shift.assignedToProfileId === currentProfileId && shift.status !== 'completed');
  const mySpots = state.spots.filter((spot) => spot.caretakerProfileId === currentProfileId);
  return (
    <main className="panel-page">
      <header className="page-head">
        <p className="eyebrow">Alex</p>
        <h1>{t.nav.myCare}</h1>
      </header>
      <section className="list-section">
        <h2>{t.sheets.upcoming}</h2>
        {mine.length === 0 ? <p className="muted">{t.sheets.noAssignedCare}</p> : mine.map((shift) => {
          const spot = getSpot(state, shift.spotId);
          if (!spot) return null;
          return (
            <article className="mini-row" key={shift.id} onClick={() => onOpenSpot(spot.id)}>
              <span>{formatTime(shift.startsAt)}</span>
              <div><strong>{spot.name}</strong><small>{shift.tasks.map((task) => t.task[task]).join(' · ')}</small></div>
            </article>
          );
        })}
      </section>
      <section className="list-section">
        <h2>{t.sheets.mySpots}</h2>
        {mySpots.map((spot) => <button className="plain-row" key={spot.id} onClick={() => onOpenSpot(spot.id)}>{spot.name}<Badge status={spot.status} t={t} /></button>)}
      </section>
      <section className="list-section three-tabs" aria-label="Care summaries">
        <button>{t.sheets.mySpots}</button>
        <button>{t.sheets.myHandoffs}</button>
        <button>{t.sheets.careHistory}</button>
      </section>
    </main>
  );
}

function CreateSpot({ center, onCreate, onBack, onClose, t }: { center: [number, number]; onCreate: (name: string, description: string, tasks: CareTask[]) => void; onBack: () => void; onClose: () => void; t: Messages }) {
  const [name, setName] = useState<string>(t.sheets.defaultSpotName);
  const [description, setDescription] = useState<string>(t.sheets.defaultSpotDescription);
  const [tasks, setTasks] = useState<CareTask[]>(['food', 'water']);
  const toggle = (task: CareTask) => setTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  return (
    <SheetShell title={t.sheets.newSpot} eyebrow={t.sheets.pickMapCenter} onBack={onBack} onClose={onClose}>
      <div className="privacy-note"><MapPin size={18} /> {t.sheets.publicMarkerNote}</div>
      <p className="muted small">{t.sheets.moveMapToPin}</p>
      <label className="field">{t.sheets.spotName}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field">{t.sheets.description}<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="large-options compact-options">
        {(['food', 'water', 'cleanup', 'catCheck'] as CareTask[]).map((task) => (
          <button className={tasks.includes(task) ? 'selected' : ''} key={task} onClick={() => toggle(task)}>{t.task[task]}</button>
        ))}
      </div>
      <p className="muted small">{t.sheets.mapCenter}: {center[1].toFixed(4)}, {center[0].toFixed(4)}</p>
      <button className="primary sticky-action" disabled={!name.trim() || tasks.length === 0} onClick={() => onCreate(name, description, tasks)}>{t.actions.saveSpot}</button>
    </SheetShell>
  );
}

function SettingsSheet({
  locale,
  onLocaleChange,
  onClose,
  t,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onClose: () => void;
  t: Messages;
}) {
  return (
    <SheetShell title={t.sheets.settings} eyebrow={t.demoMode} onClose={onClose}>
      <section className="settings-block">
        <h3>{t.sheets.language}</h3>
        <div className="segmented">
          <button className={locale === 'ko' ? 'active' : ''} onClick={() => onLocaleChange('ko')}>한국어</button>
          <button className={locale === 'en' ? 'active' : ''} onClick={() => onLocaleChange('en')}>English</button>
        </div>
      </section>
      <section className="settings-block">
        <h3>{t.sheets.mapProvider}</h3>
        <p className="muted small">
          {mapProvider === 'maplibre' ? t.sheets.mapProviderInfo : mapProvider}
        </p>
      </section>
    </SheetShell>
  );
}

export function App() {
  const [state, setState] = useState<DemoState>(() => demoRepository.load());
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem(localeStorageKey) as Locale | null) ?? 'ko');
  const [tab, setTab] = useState<Tab>('map');
  const [sheet, setSheet] = useState<Sheet>('nearby');
  const [selectedSpotId, setSelectedSpotId] = useState(state.spots[0]?.id);
  const [toast, setToast] = useState('');
  const [map, setMap] = useState<Map | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([127.111, 37.395]);
  const [zoomLevel, setZoomLevel] = useState(14.3);
  const t = messages[locale];
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
      setZoomLevel(Number(map.getZoom().toFixed(1)));
    };
    map.on('moveend', onMove);
    map.on('zoomend', onMove);
    onMove();
    return () => {
      map.off('moveend', onMove);
      map.off('zoomend', onMove);
    };
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
  const takeShift = (shiftId: string) => save(demoRepository.takeShift(state, shiftId), t.toast.shiftTaken);
  const closeSheet = () => setSheet('nearby');
  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    localStorage.setItem(localeStorageKey, nextLocale);
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = searchDemoAddress(searchQuery);
    if (!result) {
      setToast(t.sheets.searchEmpty);
      return;
    }
    map?.flyTo({ center: result.center, zoom: result.zoom, speed: 0.8 });
    setToast(localizedToast(locale, `${result.label} 지도 위치로 이동했습니다.`, `Moved map to ${result.label}.`));
    setSheet('nearby');
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">{t.location} · {t.demoMode}</p>
          <div className="brand-row"><BrandLogo /><div><strong><Wordmark /></strong><span className="brand-tagline">{t.tagline}</span></div></div>
        </div>
        <button className="icon-button" aria-label="Settings" onClick={() => setSheet('settings')}><Settings size={19} /></button>
      </div>

      {tab === 'map' ? (
        <>
          <AppMap spots={state.spots} selectedSpotId={selectedSpot?.id} onReady={setMap} onSelect={openSpot} />
          <form className="map-search" role="search" onSubmit={submitSearch}>
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t.sheets.searchPlaceholder} aria-label={t.sheets.searchPlaceholder} />
          </form>
          <div className="map-controls">
            <button className="floating" aria-label={t.actions.locateMe} onClick={() => navigator.geolocation?.getCurrentPosition((pos) => map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14.5 }))}><LocateFixed size={20} /></button>
            <div className="zoom-control" aria-label={t.sheets.mapZoomControls}>
              <button className="floating compact" aria-label={t.actions.zoomIn} onClick={() => map?.zoomIn()}><Plus size={18} /></button>
              <input
                className="zoom-range"
                aria-label={t.sheets.mapZoomLevel}
                type="range"
                min="10"
                max="18"
                step="0.1"
                value={zoomLevel}
                onChange={(event) => {
                  const zoom = Number(event.target.value);
                  setZoomLevel(zoom);
                  map?.zoomTo(zoom);
                }}
              />
              <button className="floating compact" aria-label={t.actions.zoomOut} onClick={() => map?.zoomOut()}><Minus size={18} /></button>
              <span className="zoom-value">{zoomLevel.toFixed(1)}</span>
            </div>
          </div>
          {sheet === 'createSpot' && (
            <div className="draft-pin" aria-hidden="true">
              <MapPin size={40} />
            </div>
          )}
          {sheet === 'nearby' && <NearbySheet state={state} onOpenSpot={openSpot} onTake={takeShift} onQuickCare={() => setSheet('careNow')} onAway={() => setSheet('away')} t={t} />}
          {sheet === 'spot' && selectedSpot && <SpotDetail state={state} spot={selectedSpot} onCare={() => setSheet('careNow')} onTake={takeShift} onAway={() => setSheet('away')} onBack={() => setSheet('nearby')} onClose={closeSheet} t={t} />}
          {sheet === 'careNow' && selectedSpot && (
            <CareNow
              spot={selectedSpot}
              onBack={() => setSheet('spot')}
              onClose={closeSheet}
              t={t}
              onComplete={(tasks, catsSeen, foodAmount, cleanupConfirmed, note) => {
                save(demoRepository.completeCare(state, { spotId: selectedSpot.id, tasks, catsSeen, foodAmount, cleanupConfirmed, note }), t.toast.careLogged);
                setSheet('spot');
              }}
            />
          )}
          {sheet === 'away' && selectedSpot && (
            <AwaySheet
              spot={selectedSpot}
              onBack={() => setSheet('spot')}
              onClose={closeSheet}
              t={t}
              onSubmit={(from, until, tasks, message) => {
                save(demoRepository.createHandoff(state, selectedSpot.id, from, until, tasks, message), t.toast.coverageCreated);
                setTab('care');
              }}
            />
          )}
          {sheet === 'createSpot' && (
            <CreateSpot
              center={mapCenter}
              onBack={() => setSheet('nearby')}
              onClose={closeSheet}
              t={t}
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
                  t.toast.spotCreated,
                );
                setSheet('nearby');
              }}
            />
          )}
          {sheet === 'settings' && <SettingsSheet locale={locale} onLocaleChange={changeLocale} onClose={closeSheet} t={t} />}
        </>
      ) : tab === 'care' ? (
        <CareBoard state={state} onTake={takeShift} onOpenSpot={openSpot} t={t} />
      ) : (
        <MyCare state={state} onOpenSpot={openSpot} t={t} />
      )}

      <nav className="bottom-nav" aria-label={t.sheets.primaryNavigation}>
        <button className={tab === 'map' ? 'active' : ''} onClick={() => { setTab('map'); setSheet('nearby'); }}><Home size={20} /><small>{t.nav.map}</small></button>
        <button className={tab === 'care' ? 'active' : ''} onClick={() => setTab('care')}><ListChecks size={20} /><small>{t.nav.care}</small></button>
        <button className="create" aria-label={t.actions.createSpot} onClick={() => { setTab('map'); setSheet('createSpot'); }}><Plus size={27} /></button>
        <button className={tab === 'myCare' ? 'active' : ''} onClick={() => setTab('myCare')}><HandHeart size={20} /><small>{t.nav.myCare}</small></button>
        <button onClick={() => { setTab('map'); setSheet('nearby'); }}><Waves size={20} /><small>{t.nav.nearby}</small></button>
      </nav>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button aria-label={t.sheets.dismiss} onClick={() => setToast('')}><X size={14} /></button></div>}
    </div>
  );
}
