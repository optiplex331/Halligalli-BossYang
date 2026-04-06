# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- JavaScript (ES modules) - The app code lives in `src/App.jsx` and `src/main.jsx`, with package metadata in `package.json`.
- CSS - Shared styling is implemented in `src/styles.css`.

**Secondary:**
- HTML - The Vite entry document is `index.html`.
- Markdown - Product and setup docs live in `README.md` and `docs/prd-web-halligalli.md`.

## Runtime

**Environment:**
- Node.js - Required for the Vite toolchain declared in `package.json`.
- Browser runtime - The shipped app mounts into `#root` from `index.html` and runs entirely client-side from `src/main.jsx`.
- Browser Web APIs - `src/App.jsx` depends on `window.localStorage`, `window.addEventListener`, `window.setTimeout`, `window.setInterval`, and `window.AudioContext` / `window.webkitAudioContext`.

**Package Manager:**
- npm - The repo uses npm scripts in `package.json`.
- Lockfile: present in `package-lock.json` (lockfileVersion `3`).

**Version constraints detected:**
- `package.json` declares `react` `^19.1.1`, `react-dom` `^19.1.1`, `vite` `^7.1.3`, and `@vitejs/plugin-react` `^5.0.0`.
- `package-lock.json` resolves `react` to `19.2.4`, `react-dom` to `19.2.4`, `vite` to `7.3.1`, and `@vitejs/plugin-react` to `5.1.4`.
- `package-lock.json` shows Vite 7 and `@vitejs/plugin-react` 5 requiring Node `^20.19.0 || >=22.12.0`.

## Frameworks

**Core:**
- React 19 - UI rendering and state management in `src/App.jsx` and `src/main.jsx`.
- Vite 7 - Dev server, build pipeline, and preview server configured through `package.json`, `vite.config.js`, and `index.html`.

**Testing:**
- Not detected - No `vitest`, `jest`, or test config files are present in the repository root.

**Build/Dev:**
- `@vitejs/plugin-react` 5 - Enables the React transform in `vite.config.js`.
- Rollup / esbuild via Vite - Bundling and transforms are pulled in transitively through `vite` in `package-lock.json`.

## Key Dependencies

**Critical:**
- `react` - The entire app is a single React tree rooted in `src/main.jsx`.
- `react-dom` - `src/main.jsx` uses `ReactDOM.createRoot(...)` to mount the app.
- `vite` - Provides `npm run dev`, `npm run build`, and `npm run preview` from `package.json`.

**Infrastructure:**
- `@vitejs/plugin-react` - The only explicit Vite plugin; registered in `vite.config.js`.
- Static asset pipeline - The boss image is served from `public/yang-boss.png` and referenced as `/yang-boss.png` in `src/App.jsx`.

## Configuration

**Environment:**
- No `.env` files were detected at repo root or one level below during analysis.
- No `import.meta.env` or `process.env` usage was found in `src/`, `index.html`, or `vite.config.js`.
- Runtime settings are stored in browser `localStorage` under `halligalli_settings`, `halligalli_best`, and `halligalli_recent` in `src/App.jsx`.

**Build:**
- `vite.config.js` uses the default `defineConfig({ plugins: [react()] })` shape with no custom aliases, env injection, server config, or build targets.
- `index.html` is the only HTML entry and loads `src/main.jsx` directly as a module.
- Generated output is written to `dist/`, which is gitignored in `.gitignore`.

## Platform Requirements

**Development:**
- Node.js version compatible with Vite 7 / plugin-react 5 (`^20.19.0 || >=22.12.0` per `package-lock.json`).
- npm to run `npm install`, `npm run dev`, `npm run build`, and `npm run preview` from `package.json`.
- A modern browser with ES module support; sound features additionally depend on Web Audio support used in `src/App.jsx`.

**Production:**
- Static hosting is sufficient. The app has no server code, no API proxy, and no backend runtime; the deployable surface is `index.html`, bundled assets under `dist/`, and static assets such as `yang-boss.png`.

---

*Stack analysis: 2026-04-06*
