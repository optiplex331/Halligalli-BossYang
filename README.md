# Halligalli Boss Practice

A lightweight web practice app for Halligalli, focused on single-player reaction training with a more table-like layout and a Boss mode featuring Yang.

## Features

- `3-6` player table layouts
- Clockwise flipping flow based on visible table order
- Top-card-only validation, matching the core tabletop rule
- Bell hit, miss, and penalty logic
- Boss Mode with Yang taunts and visual pressure
- Chinese / English language switch
- Sound effects and local score persistence
- Animated end-of-round score breakdown

## Tech Stack

- React
- Vite
- Plain CSS

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

## Gameplay Notes

- Players flip cards clockwise.
- Only each player's top visible card counts.
- Ring only when one fruit totals exactly `5`.
- A correct ring collects all face-up table cards.
- A wrong ring applies a penalty based on half the table cards, rounded up.
- In Boss Mode, Yang taunts the player after missed bell windows.

## Project Structure

```text
src/
  App.jsx
  main.jsx
  styles.css
public/
  yang-boss.png
docs/
  prd-web-halligalli.md
```

## Current Scope

This is an MVP focused on:

- single-player training
- tabletop-like presentation
- local-only progress

It does not yet include:

- online multiplayer
- login / cloud sync
- official card-set replication

## Status

Production build verified with:

```bash
npm run build
```
