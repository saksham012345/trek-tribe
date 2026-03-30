# Modular Monolith Structure

Each domain module lives here and follows this pattern:

```
modules/
  <domain>/
    <domain>.routes.ts      — Express router, thin: validate → call controller → return
    <domain>.controller.ts  — Request/response handling, calls service
    <domain>.service.ts     — Business logic (moved from route files)
    <domain>.repository.ts  — Database queries (optional, for complex domains)
```

## Migration Status

| Module         | Routes | Controller | Service | Repository |
|----------------|--------|------------|---------|------------|
| crm            | ✅     | ✅         | ✅      | —          |
| auth           | ✅     | inline     | ✅      | —          |
| trips          | ✅     | ✅         | ✅      | —          |
| bookings       | ✅     | ✅         | ✅      | —          |
| payments       | ✅     | ✅         | ✅      | —          |
| subscriptions  | ✅     | ✅         | ✅      | —          |
| notifications  | ✅     | ✅         | ✅      | —          |
| analytics      | ✅     | ✅         | ✅      | —          |
| organizer      | ✅     | ✅         | ✅      | —          |
| admin          | ✅     | ✅         | ✅      | —          |
| marketplace    | ✅     | ✅         | ✅      | —          |

## Rules

1. Routes only: validate input, call controller, return response.
2. Controllers only: extract params, call service, format response.
3. Services only: business logic, no req/res objects.
4. Repositories only: Mongoose queries, no business logic.
5. Never import from a sibling module's internals — use the module's public service.
