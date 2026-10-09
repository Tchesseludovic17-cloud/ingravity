---
name: Orval API generation
description: Non-obvious TypeScript issues encountered when regenerating the workspace API clients.
---

When adding object responses to `lib/api-spec/openapi.yaml`, keep success response schemas inline unless a shared named response schema is actually needed. Orval can export a named Zod schema from `generated/api.ts` and a same-named TypeScript interface from `generated/types/`, which conflicts in the `api-zod` barrel. Generated React clients using `Headers.entries()` also require `dom.iterable` in the client package's TypeScript `lib` setting.

**Why:** API code generation failed typechecking after adding the action endpoint until both issues were fixed.

**How to apply:** After changing OpenAPI, run `pnpm --filter @workspace/api-spec run codegen`, then run the workspace typecheck.
