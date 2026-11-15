# Frontend

React + Vite + TypeScript. MapLibre for the map, Terra Draw for drawing, Observable Plot for charts.

```bash
npm install
cp .env.example .env.local   # VITE_USE_MOCKS=true works without the API
npm run dev
```

- `src/types.ts` mirrors [docs/CONTRACT.md](../docs/CONTRACT.md). Change both together.
- `src/api.ts` is the typed client. With `VITE_USE_MOCKS=true` it serves `src/mocks/*.json` after a 300 ms delay.
- Regenerate the mocks with `node scripts/make-mocks.mjs`.
