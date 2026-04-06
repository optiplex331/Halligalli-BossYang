# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```text
[project-root]/
├── src/                 # Runtime app code: React entrypoint, game logic, and CSS
├── public/              # Static public assets served by Vite
├── docs/                # Product and design documentation
├── dist/                # Generated production build output
├── .planning/codebase/  # Generated codebase mapping documents
├── index.html           # HTML shell and Vite module entry
├── package.json         # Scripts and dependency manifest
├── vite.config.js       # Vite configuration
├── README.md            # Developer-facing project overview
└── AGENTS.md            # Repo-specific instructions for coding agents
```

## Directory Purposes

**`src/`:**
- Purpose: Hold all active application code.
- Contains: `src/main.jsx`, `src/App.jsx`, `src/styles.css`
- Key files: `src/App.jsx`, `src/main.jsx`, `src/styles.css`
- Current structure: Flat. The repository does not currently split hooks, components, utilities, or assets into subdirectories.

**`public/`:**
- Purpose: Hold assets referenced by absolute public URLs.
- Contains: `public/yang-boss.png`
- Key files: `public/yang-boss.png`

**`docs/`:**
- Purpose: Hold non-runtime product documentation.
- Contains: `docs/prd-web-halligalli.md`
- Key files: `docs/prd-web-halligalli.md`

**`dist/`:**
- Purpose: Hold Vite build output.
- Contains: Generated HTML and bundled assets under `dist/assets/`
- Key files: Not stable; treat the directory as generated output only.

**`.planning/codebase/`:**
- Purpose: Hold generated architecture and quality reference documents for future planning commands.
- Contains: Mapping documents such as `ARCHITECTURE.md` and `STRUCTURE.md`
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `index.html`: Browser shell that creates `#root` and loads `/src/main.jsx`
- `src/main.jsx`: React bootstrap that imports `src/App.jsx` and `src/styles.css`
- `src/App.jsx`: Effective application entry and the only runtime feature module

**Configuration:**
- `package.json`: npm scripts (`dev`, `build`, `preview`) and React/Vite dependency declarations
- `vite.config.js`: Minimal Vite config using `@vitejs/plugin-react`
- `AGENTS.md`: Working conventions for contributors and coding agents

**Core Logic:**
- `src/App.jsx`: Deck creation, player model, screen state, timers, scoring, persistence, audio, and JSX for home/play/result screens

**Styling:**
- `src/styles.css`: Shared styles for all screens and components

**Static Assets:**
- `public/yang-boss.png`: Boss portrait image referenced by `src/App.jsx`

**Documentation:**
- `README.md`: Setup and project summary
- `docs/prd-web-halligalli.md`: Product requirements and gameplay scope

**Testing:**
- Not detected. There are no test files and no dedicated test directories in the current repository.

## Naming Conventions

**Files:**
- React modules use PascalCase for top-level component files: `src/App.jsx`
- Entry and config files use conventional lowercase names: `src/main.jsx`, `vite.config.js`, `index.html`
- Stylesheets use lowercase descriptive names: `src/styles.css`
- Documentation uses lowercase or uppercase markdown names depending on role: `README.md`, `AGENTS.md`, `docs/prd-web-halligalli.md`

**Directories:**
- Runtime and asset directories use short lowercase names: `src`, `public`, `docs`, `dist`
- Planning artifacts live under dot-prefixed lowercase directories: `.planning/codebase`

## Where to Add New Code

**New Game Logic or Screen Behavior:**
- Primary code: `src/App.jsx`
- Use this location while the app remains a single-module implementation.
- If the new behavior introduces a clearly isolated unit, extract it from `src/App.jsx` into a new module under `src/` and keep `App` as the orchestrator.

**New Presentational Component:**
- Implementation: Add a new file under `src/`, for example `src/ResultPanel.jsx` or `src/TableSeat.jsx`
- Integration point: Import it back into `src/App.jsx`
- Styling: Add matching selectors to `src/styles.css`

**New Shared Utility:**
- Shared helpers: Add a dedicated module under `src/`, for example `src/gameState.js` or `src/storage.js`
- Use this when logic currently embedded in `src/App.jsx` needs reuse or independent testing.

**New Asset:**
- Public URL assets: `public/`
- If the asset should be loaded with a root-relative path like `/asset-name.png`, place it in `public/`

**New Documentation:**
- Product or design notes: `docs/`
- Contributor workflow notes: repository root if they behave like `README.md` or `AGENTS.md`

**Future Tests:**
- Preferred locations based on repo instructions: co-locate beside the source file or add `src/__tests__/`
- Example placement: `src/App.test.jsx` or `src/__tests__/App.test.jsx`

## Structural Guidance

**Current Shape:**
- The application is intentionally small and centralized.
- `src/App.jsx` is the only place that currently mixes domain logic, screen control, and rendering.

**When to Preserve the Flat Layout:**
- Small UI adjustments, copy changes, styling changes, or contained rule tweaks should stay in `src/App.jsx` and `src/styles.css`.

**When to Split Files:**
- Extract code once a feature becomes independently understandable, such as:
- a reusable presentational component now repeated inside `src/App.jsx`
- a helper cluster like deck generation or local storage persistence that can live in a standalone module
- a large screen section, such as result breakdown rendering, that obscures the main `App` flow

**Import Direction to Maintain:**
- `index.html` -> `src/main.jsx`
- `src/main.jsx` -> `src/App.jsx` and `src/styles.css`
- Additional modules should continue to flow inward toward `src/App.jsx`, not create circular dependencies between sibling files.

## Special Directories

**`dist/`:**
- Purpose: Production build artifacts produced by `vite build`
- Generated: Yes
- Committed: Yes, currently present in the repository, but should not be hand-edited

**`.planning/codebase/`:**
- Purpose: Generated codebase reference docs
- Generated: Yes
- Committed: Yes, intended for planner/executor consumption

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes
- Committed: No

## Practical Navigation Notes

- Start architectural work in `src/App.jsx`; it contains the state owner, the game loop, and all screen branches.
- Use `src/main.jsx` only when changing app bootstrap behavior or adding global providers.
- Use `src/styles.css` for every UI change unless the repository later adopts CSS modules or another styling system.
- Treat `public/yang-boss.png` as the dependency for both the home hero boss card and the in-game boss presence UI in `src/App.jsx`.

---

*Structure analysis: 2026-04-06*
