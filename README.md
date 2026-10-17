# Pip · Junior Dream Engineer

Our entry for **haX.baby — Baby's First Website** (Track 1: Pip). A scroll story through painted, Renaissance-style dream scenes, framed by a fake 90s operating system, **DreamOS 93**.

> Work in progress during the 17–19 Oct 2026 sprint.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run check      # needs `npx vite preview --port 4173` running: console-error check at 3 sizes
```

Art pipeline (raw PNGs live outside the repo in `assets-raw/`):

```bash
python3 -I scripts/process_assets.py
```

## How it's built

- Vite + TypeScript, no framework. GSAP, Lenis, Matter.js where needed.
- Every feature is a module listed in `src/features.config.ts`; the registry wires its Start-menu items, apps and sounds.
- Phone-first, keyboard-accessible, respects reduced motion, zero console errors.
