# Catmap

**Where people care for community cats together.**

Catmap helps local communities coordinate care for community cats.

People can discover nearby care spots, record feeding and water refills, take open care shifts, and cover a spot when its regular caretaker is away.

## Core Concept

Catmap is spot-based community cat care coordination. The MVP is centered on public care spots, care status, quick care logging, open shifts, away coverage, and personal care schedules.

The demo data model separates `exactLatitude` / `exactLongitude` from `publicLatitude` / `publicLongitude`. The public map only renders approximate public coordinates so future production access can reveal exact locations only to caretakers or assigned helpers.

## Tech Stack

- React
- Vite
- TypeScript
- MapLibre GL JS with OpenStreetMap raster tiles as the no-key demo fallback
- Lightweight CSS
- lucide-react icons
- GitHub Pages and GitHub Actions

## Local Development

```bash
npm install
npm run dev
```

## Demo Mode

When Supabase environment variables are not present, Catmap runs in Demo Mode. Demo Mode uses mock data and localStorage persistence so the main flows work after refresh:

- open map and select spots
- view spot details
- complete care
- take care shifts
- create an "I'm away" coverage request
- cover handoff shifts
- view My Care
- create a new spot from the current map center

To reset demo data, clear the browser localStorage key `catmap-demo-state-v1`.

## Environment Variables

Copy `.env.example` to `.env.local` when backend credentials are available:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MAP_PROVIDER=maplibre
VITE_NAVER_MAP_CLIENT_ID=
VITE_KAKAO_JAVASCRIPT_KEY=
```

Secrets should not be committed.

## Maps For Korea

The deployed MVP currently uses MapLibre with OpenStreetMap tiles so it can run without API keys. For a Korea-first service, the intended production path is to switch the map provider to NAVER Maps or Kakao Maps after issuing keys and registering the production domain.

- NAVER Maps: better fit for Korean consumer map expectations and native app shell continuity.
- Kakao Maps: also viable, with JavaScript SDK quota and Kakao platform integration.
- MapLibre/OpenStreetMap: useful as a development fallback, but Korean POI and sensitive facility rendering may not match domestic service expectations.

The environment variable `VITE_MAP_PROVIDER` is reserved for provider switching. Until NAVER/Kakao keys are configured, the app keeps the MapLibre fallback.

## Build

```bash
npm run build
```

Optional lint:

```bash
npm run lint
```

## GitHub Pages Deployment

The app is configured for GitHub Pages at:

```text
https://catmap-labs.github.io/catmap-web/
```

`vite.config.ts` sets the base path to `/catmap-web/`. The workflow in `.github/workflows/deploy.yml` runs `npm ci`, builds the app, and publishes the generated `dist` output to the `gh-pages` branch used by GitHub Pages.

## Future Supabase Integration

The MVP keeps domain types and data access separated under `src/types` and `src/services/data`. A Supabase repository can later implement the same operations while preserving the UI flows.

Planned entities:

- Profile
- Spot
- SpotMember
- Routine
- Shift
- Assignment
- CareLog
- HandoffRequest
