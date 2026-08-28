# Catmap

**Where people care for community cats together.**

Catmap helps local communities coordinate care for community cats. People can discover nearby care spots, record feeding and water refills, take open care shifts, and cover a spot when its regular caretaker is away.

## Core Concept

Catmap is **spot-based community cat care coordination**. The product is not a social feed. The main object is a care spot, and the main workflows are:

- see nearby spots on a map
- understand whether each spot is cared today, due soon, or needs someone
- log quick care actions in the field
- take open care shifts
- create an away request when a caretaker cannot visit
- cover individual handoff shifts
- review assigned care in My Care

The domain model separates `exactLatitude` / `exactLongitude` from `publicLatitude` / `publicLongitude`. The public map only renders approximate public coordinates. A future backend can reveal exact coordinates only to trusted roles such as spot caretakers or assigned shift helpers.

## Tech Stack

- React 18
- Vite 5
- TypeScript
- MapLibre GL JS
- OpenStreetMap raster tiles as the no-key demo fallback
- Plain CSS with mobile-first responsive layout
- lucide-react icons
- GitHub Pages
- GitHub Actions

The current map provider is intentionally keyless so the MVP can run on GitHub Pages. For Korea-first production usage, switch to NAVER Maps or Kakao Maps through a provider adapter once API keys and domains are registered.

## Frontend Framework Decision

The MVP uses **React + Vite**, not Next.js.

Reasons:

- GitHub Pages deployment is static and simple.
- The app is map-first and client-heavy.
- Demo Mode runs fully in the browser.
- There is no current need for server-side rendering.
- React/Vite keeps the mobile web shell lightweight for a future native wrapper.

Next.js can be reconsidered later if Catmap needs SEO-heavy public pages, integrated server routes, edge middleware, or a single full-stack deployment platform.

## Local Development

```bash
npm install
npm run dev
```

Preview a production build locally:

```bash
npm run build
npm run preview
```

Optional lint:

```bash
npm run lint
```

## Demo Mode

When backend credentials are not present, Catmap runs in Demo Mode. Demo Mode uses seeded data, an in-browser memory database, and localStorage snapshot persistence so the main flows continue to work after refresh.

Demo Mode supports:

- map spot selection
- care status markers and numeric clusters
- collapsible spot detail bottom sheet
- quick Care Now logging
- care status updates
- care board shift claiming
- I'm Away handoff creation
- coverage claiming
- My Care schedule updates
- spot creation from the current map center pin
- Korean / English language switching

The demo repository merges the latest seeded station spots with the user's localStorage state. This keeps newly added Korea sample spots and corrected approximate coordinates visible for existing browsers while preserving user-created spots, claimed shifts, handoff requests, and care completion state.

To reset demo data, clear the browser localStorage key:

```text
catmap-demo-state-v1
```

## Environment Variables

Copy `.env.example` to `.env.local` when credentials are available:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

VITE_MAP_PROVIDER=maplibre
VITE_NAVER_MAP_CLIENT_ID=
VITE_KAKAO_JAVASCRIPT_KEY=
```

Do not commit real secrets.

## Folder Structure

```text
src/
  App.tsx
  i18n/
    en.ts
    ko.ts
  services/
    data/
      catmapRepository.ts
      demoData.ts
      demoRepository.ts
      memoryDb.ts
  styles/
    app.css
  types/
    domain.ts
public/
  catmap-logo.svg
  favicon.svg
.github/
  workflows/
    deploy.yml
```

Key files:

- `src/types/domain.ts`: domain entities and TypeScript contracts.
- `src/services/data/demoData.ts`: seed data used to populate Demo Mode.
- `src/services/data/memoryDb.ts`: browser memory database that stores table-like collections.
- `src/services/data/catmapRepository.ts`: repository interface the UI depends on.
- `src/services/data/demoRepository.ts`: current Demo Mode repository using memory DB plus localStorage snapshots.
- `src/i18n/*.ts`: UI strings. Add new user-facing copy here instead of hardcoding it in components.
- `src/styles/app.css`: visual system, responsive layout, map overlays, sheets, navigation, and brand styling.

## Data Layer

The UI should depend on repository operations, not backend details. The current implementation uses:

```text
seed data -> MemoryCatmapDb -> demoRepository -> React UI
                         -> localStorage snapshot
```

The repository currently exposes operations for:

- `load`
- `save`
- `takeShift`
- `completeCare`
- `createHandoff`
- `createSpot`

This is intentionally close to how a real API repository would work.

## Future Backend Options

### Supabase Direct

A Supabase repository can implement `CatmapRepository` and call Supabase tables directly from the client. This is fast for early validation, but row-level security and location privacy rules must be carefully designed before production.

### Node Backend

A Node backend is also viable. In that setup:

```text
React UI -> API repository -> Node API -> Postgres/Supabase
```

The React app can keep the same domain types and UI flows. The implementation work would be:

- add an API repository implementing `CatmapRepository`
- move mutations such as `takeShift`, `completeCare`, and `createHandoff` to HTTP endpoints
- store `exactLatitude` / `exactLongitude` behind role-based authorization
- keep public map queries limited to `publicLatitude` / `publicLongitude`
- use the static GitHub Pages app as the shell or move hosting to the backend platform if needed

### Spring Boot Backend

Spring Boot is a strong fit if the backend will be maintained by Java/Spring developers. Catmap has authorization, role-based location access, shift assignment, care logging, and handoff workflows where explicit transactions and typed service boundaries are useful.

A likely production architecture:

```text
React/Vite web app -> Spring Boot API -> PostgreSQL or Supabase Postgres
```

This is also AI-assist friendly because controllers, DTOs, services, repositories, migrations, and tests can be specified with clear contracts.

### FastAPI Backend

FastAPI is worth considering if Catmap later adds AI-heavy backend workflows, computer vision queues, or Python-native data jobs. For the current care coordination domain, it is not required.

## Domain Entities

Current MVP entities:

- `Profile`
- `Spot`
- `CatProfile`
- `SpotMember`
- `Routine`
- `Shift`
- `Assignment`
- `CareLog`
- `HandoffRequest`

Production DB tables can map closely to these interfaces.

## Maps For Korea

The deployed MVP currently uses MapLibre with OpenStreetMap tiles because it works without API keys. This is useful for development, but it can expose OpenStreetMap details that Korean users may not expect.

For a Korea-first service:

- NAVER Maps is likely the best default for domestic consumer expectations.
- Kakao Maps is also viable, especially if Kakao account/platform integration is planned.
- MapLibre/OpenStreetMap should remain as a fallback for local development and no-key demo builds.

The environment variable `VITE_MAP_PROVIDER` is reserved for provider switching.

## GitHub Pages Deployment

The app is configured for:

```text
https://catmap-labs.github.io/catmap-web/
```

`vite.config.ts` sets:

```ts
base: '/catmap-web/'
```

The workflow at `.github/workflows/deploy.yml` installs dependencies, builds the app, and publishes the generated `dist` output to GitHub Pages.
