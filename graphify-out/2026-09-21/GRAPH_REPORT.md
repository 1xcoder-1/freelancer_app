# Graph Report - freelancer book  (2026-09-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 275 nodes · 273 edges · 26 communities (20 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6fdfdd04`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- mobile/package.json
- desktop/package.json
- dependencies
- compilerOptions
- expo
- compilerOptions
- compilerOptions
- dependencies
- BackendStatus.tsx
- devDependencies
- compilerOptions
- layout.tsx
- scripts
- health.py
- devDependencies
- index.ts
- build
- types/package.json
- scripts
- database.py
- Settings
- root
- __init__.py
- eslint.config.mjs
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `compilerOptions` - 11 edges
3. `expo` - 10 edges
4. `compilerOptions` - 10 edges
5. `scripts` - 8 edges
6. `compilerOptions` - 7 edges
7. `scripts` - 5 edges
8. `build` - 5 edges
9. `scripts` - 5 edges
10. `scripts` - 5 edges

## Surprising Connections (you probably didn't know these)
- `BackendStatus()` --calls--> `checkBackendHealth()`  [EXTRACTED]
  apps/web/src/components/BackendStatus.tsx → apps/web/src/lib/api.ts
- `BackendStatus()` --calls--> `getSystemStatus()`  [EXTRACTED]
  apps/web/src/components/BackendStatus.tsx → apps/web/src/lib/api.ts

## Import Cycles
- None detected.

## Communities (26 total, 6 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.07
Nodes (28): react, zod, name, packageManager, private, scripts, build, dev (+20 more)

### Community 1 - "mobile/package.json"
Cohesion: 0.07
Nodes (25): HealthStatus, styles, devDependencies, @babel/core, @types/react, @types/react-native, typescript, react (+17 more)

### Community 2 - "desktop/package.json"
Cohesion: 0.08
Nodes (21): description, main, name, scripts, build, compile, dev, start (+13 more)

### Community 3 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, axios, @clerk/nextjs, clsx, framer-motion, @hookform/resolvers, lucide-react, next (+11 more)

### Community 4 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 5 - "expo"
Cohesion: 0.11
Nodes (17): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, expo, android, icon (+9 more)

### Community 6 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+4 more)

### Community 7 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 8 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, expo, expo-constants, expo-device, expo-notifications, expo-router, expo-status-bar, react (+4 more)

### Community 9 - "BackendStatus.tsx"
Cohesion: 0.31
Nodes (7): BackendStatus(), apiClient, checkBackendHealth(), getSystemStatus(), HealthCheckResponse, SystemStatusResponse, axios

### Community 10 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 11 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, declaration, module, moduleResolution, skipLibCheck, strict, target, include

### Community 12 - "layout.tsx"
Cohesion: 0.25
Nodes (5): nextConfig, geistMono, geistSans, metadata, next

### Community 13 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build:desktop, build:web, dev, dev:api, dev:desktop, dev:mobile, dev:web

### Community 14 - "health.py"
Cohesion: 0.29
Nodes (4): health_check(), get, get, system_status()

### Community 15 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, concurrently, electron, electron-builder, @types/node, typescript, wait-on

### Community 16 - "index.ts"
Cohesion: 0.29
Nodes (6): Client, Invoice, Project, Task, User, Workspace

### Community 17 - "build"
Cohesion: 0.33
Nodes (6): build, appId, files, productName, win, target

### Community 18 - "types/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, types, version

### Community 19 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, android, ios, start, web

## Knowledge Gaps
- **193 isolated node(s):** `HealthStatus`, `Client`, `Invoice`, `Project`, `Task` (+188 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 211 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `typescript` connect `desktop/package.json` to `web/package.json`, `mobile/package.json`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `web/package.json`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `mobile/package.json`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `HealthStatus`, `Client`, `Invoice` to the rest of the system?**
  _193 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `mobile/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `desktop/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._