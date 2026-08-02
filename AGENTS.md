# AGENTS.md

## Commands

### Lint
```bash
npm run lint
```

### Typecheck
```bash
npx tsc --noEmit
```

### Tests
```bash
npm run test
```

### Format check
```bash
npx prettier --check .
```

## Conventions
- TypeScript strict mode enabled; no `any` types.
- Zod schemas + `z.infer` types for all validation schemas.
- Domain types live in `src/lib/types/` with a barrel at `src/lib/types/index.ts`.
- Existing schemas and types are re-exported from `src/lib/schemas/index.ts`.
