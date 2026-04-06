# Repository Guidelines

## Project Structure & Module Organization
This repository is a small Vite + React app for Halligalli practice. Keep active app code in `src/`:

- `src/App.jsx` contains the main game flow and UI state.
- `src/main.jsx` boots the React app.
- `src/styles.css` holds the shared presentation layer.
- `public/` stores static assets such as `public/yang-boss.png`.
- `docs/` holds product or design notes, currently `docs/prd-web-halligalli.md`.
- `dist/` is build output; treat it as generated and do not hand-edit it.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the local Vite dev server, typically at `http://localhost:5173`.
- `npm run build` creates a production bundle in `dist/`.
- `npm run preview` serves the built bundle locally for a final smoke check.

Run `npm run build` before opening a PR to catch production-only issues.

## Coding Style & Naming Conventions
Follow the existing style in `src/`: 2-space indentation, semicolons, and double quotes in JavaScript. Prefer functional React components and keep related constants near the top of the file. Use:

- `PascalCase` for React components
- `camelCase` for variables and functions
- `UPPER_SNAKE_CASE` for fixed configuration keys and constants
- kebab-case CSS class names such as `.boss-card` or `.primary-button`

There is no configured ESLint or Prettier setup yet, so match the current file formatting closely and keep edits consistent.

## Testing Guidelines
There is no automated test framework configured yet. For now, verify changes with:

1. `npm run dev` for interactive gameplay checks
2. `npm run build` for production validation
3. `npm run preview` for a quick post-build smoke test

When adding tests later, place them beside the source file or under a dedicated `src/__tests__/` folder and use names like `App.test.jsx`.

## Commit & Pull Request Guidelines
The current git history uses short imperative commit subjects, for example: `Add Halligalli boss practice MVP`. Follow that pattern.

PRs should include a clear summary, note any gameplay or UI changes, list manual verification steps, and attach screenshots or a short recording for visible interface updates.
