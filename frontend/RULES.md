# Frontend Engineering Rules & Guidelines

> Standards and conventions for the Weather-Aware Truck Routing frontend application.
> Applies to all frontend work in `frontend/`.

---

## 1. Component Architecture & UI Standards

### 1.1 Always Use shadcn/ui

- Use **shadcn/ui** for UI primitives (`Button`, `Input`, `Dialog`, `Slider`, `Card`, `Badge`, `Tooltip`, `Select`, etc.).
- Install and configure components via `pnpm dlx shadcn@latest add <component>` following the established `components.json` layout.
- Custom components should compose shadcn primitives and utilities (`cn()`) rather than re-inventing base HTML elements.

### 1.2 Color & Theming Rules

- **No arbitrary or custom hardcoded color classes** (e.g. `bg-[#1a202c]`, `text-[#ff0000]`, `bg-blue-500`).
- Stick strictly to semantic theme tokens defined in CSS variables (`src/index.css`):
  - `bg-background`, `text-foreground`
  - `bg-card`, `text-card-foreground`
  - `bg-popover`, `text-popover-foreground`
  - `bg-primary`, `text-primary-foreground`
  - `bg-secondary`, `text-secondary-foreground`
  - `bg-muted`, `text-muted-foreground`
  - `bg-accent`, `text-accent-foreground`
  - `bg-destructive`, `text-destructive-foreground`
  - `border-border`, `border-input`, `ring-ring`
- For risk levels, map status to semantic indicators or clean badge variants without breaking dark/light design system consistency.

### 1.3 Minimal & Purposeful Icons

- Keep icon usage restrained and subtle for a clean, executive, professional feel.
- Do not clutter table rows, list items, or every single heading with icons.
- Prefer Lucide icons (`lucide-react`) when an icon is necessary (e.g. navigational chevrons, status badges, explicit actions).

### 1.4 Component Optimization & Pragmatism

- **Optimized, but never over-optimized**:
  - React Compiler is active in this project (`babel-plugin-react-compiler`); avoid manual, speculative `useMemo` / `useCallback` wraps everywhere unless dealing with expensive transformations or specific hook dependency stability.
  - Split views logically by responsibility (`RouteForm`, `RouteMap`, `CheckpointPanel`, `ForecastSlider`) to prevent root re-render cascades.
  - Keep state as local as possible; lift only when cross-component communication is required.

---

## 2. File Naming Conventions & Project Structure

### 2.1 Strictly Kebab-Case Files

- **All files and folders must use `kebab-case`** (e.g. `app.tsx`, `app-layout.tsx`, `app-sidebar.tsx`, `plan-route-page.tsx`, `use-plan-route-mutation.ts`, `use-mobile.ts`).
- Never use PascalCase (e.g. `App.tsx`, `AppSidebar.tsx`) or camelCase for file names.
- This ensures consistency across OS environments (macOS/Linux case sensitivity) and standardizes imports.

---

## 3. Type Safety & TypeScript Standards

### 3.1 Zero Tolerance for `any`

- **Never use `any`**.
- Use strict interfaces, type aliases, generics, or `unknown` with runtime narrowing / Zod parsing if dynamic data is encountered.
- Explicitly type API response payloads, query return types, mutation variables, and component props.
- Keep `tsc -b` (`pnpm typecheck`) green at all times.

---

## 3. Data Fetching & State Management (TanStack Query)

### 3.1 Architecture Overview

Follow a clean 3-layer architecture for data fetching:

```text
Axios Client (API Layer)
  └── Query / Mutation Hooks Layer (TanStack Query)
        └── UI Components / Page
```

### 3.2 Directory Structure

```text
frontend/src/
├── api/
│   ├── client.ts              # Pre-configured Axios instance (baseURL, headers, interceptors)
│   ├── endpoints/             # Raw request functions
│   │   └── routes.ts          # planRoute(data: PlanRouteRequest): Promise<PlanRouteResponse>
│   └── types.ts               # Shared request/response TypeScript definitions
├── hooks/
│   ├── queries/               # TanStack Query query hooks (useRoutePlanQuery, etc.)
│   └── mutations/             # TanStack Query mutation hooks (usePlanRouteMutation, etc.)
```

### 3.3 Axios Helper Standards

- Axios client in `src/api/client.ts` sets up:
  - Base URL from environment (`VITE_API_BASE_URL` or `/api/v1/`).
  - Request headers including standard client identification (`X-Client-Id` from local storage).
  - Strongly typed API helper functions:
    ```typescript
    export async function planRoute(payload: PlanRouteRequest): Promise<PlanRouteResponse> {
      const { data } = await apiClient.get<PlanRouteResponse>("/routes/plan/", {
        params: {
          origin_lat: payload.origin.lat,
          origin_lng: payload.origin.lng,
          origin_name: payload.origin.name,
          dest_lat: payload.destination.lat,
          dest_lng: payload.destination.lng,
          dest_name: payload.destination.name,
          departure_time: payload.departure_time,
          load_weight_lbs: payload.load_weight_lbs,
        },
      });
      return data;
    }
    ```

### 3.4 Query & Mutation Hooks

- Encapsulate all query keys using consistent query key factories:
  ```typescript
  export const routePlanKeys = {
    all: ["routes"] as const,
    plan: (params: PlanRouteRequest | null) => ["routes", "plan", params] as const,
  };
  ```
- Wrap API calls in dedicated, reusable hooks:
  - `useRoutePlanQuery(params)` for querying and caching route plans.
  - Return typed query states (`isFetching`, `isLoading`, `error`, `data`).
- Handle errors gracefully with user-friendly error banners or toast notifications; do not crash UI trees.

---

## 4. Routing (TanStack Router)

### 4.1 Single Route Strategy

- Setup `@tanstack/react-router` for full type-safe client-side routing.
- The application currently has **one primary route**:
  - Path: `/` (Index route).
  - Purpose: Route planning, origin/destination search & selection, route inspection, corridor heatmap, forecast slider, and checkpoint analysis.
- Router configuration should remain clean and extensible so future routes (e.g. history, settings) can be added seamlessly without breaking architecture.

---

## 5. User Experience & Aesthetics

### 5.1 Modern & Polished Feel

- **Visual hierarchy**: Clean card groupings, subtle borders, high-contrast readable typography.
- **Micro-interactions**: Smooth transitions on hover, loading skeletons during route calculation, disable states on forms while queries are pending.
- **Responsiveness**: Responsive split layout on desktop (form & metrics panel alongside interactive map), collapsible panels on compact screens.
- **Error boundaries & empty states**: Clean fallback states when no route is planned yet or when upstreams fail.
