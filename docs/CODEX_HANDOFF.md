# Codex Handoff

## Current Phase

Diagnostic API + RBAC Foundation

## Completed

- Added shared diagnostic type, status, and priority constants/types.
- Added `DiagnosticOrder` for MedicalVisit-owned request metadata.
- Added separate `DiagnosticOrderItem` records for independently managed tests
  and imaging services.
- Added historical service and ordering-doctor snapshots, status audit fields,
  validation, and query indexes.
- Documented domain boundaries and future extension points.
- Added atomic DiagnosticOrder plus DiagnosticOrderItem creation.
- Added safe single-order and bounded filtered list endpoints.
- Added server-derived Patient, Doctor, and audit ownership with role checks.
- Added normalized input validation and per-request duplicate-code rejection.
- Added database-level per-order service-code uniqueness and safe duplicate-key
  conflict handling.
- Defined UTC date-only filters and timezone-explicit timestamp filters.
- Added a reusable deterministic aggregate-order-status calculation.

## Architecture Decisions

- Use Order + Items, with items in a separate collection.
- Each order is homogeneous: `LAB` or `IMAGING`; X-Ray is `IMAGING`.
- Item status is authoritative; order status is a transactionally maintained
  aggregate so partial completion/cancellation is represented accurately.
- Orders belong to a `MedicalVisit`; `patientId` is denormalized for queries but
  must be derived from the MedicalVisit by the API.
- Ordering doctor identity must be authenticated/validated. The name snapshot
  preserves historical readability.
- No service catalog exists. Immutable service code/name snapshots are stored;
  a future optional catalog reference must not replace them.
- Future Lab and Imaging results should use type-specific records referencing a
  `DiagnosticOrderItem`.
- Future Billing should reference `DiagnosticOrderItem`, not the parent order.
- Only the active Doctor assigned to the MedicalVisit can create an order.
  `patientId`, ordering Doctor, Doctor snapshot, item type, and audit fields are
  derived on the server.
- `ADMIN` and `STAFF` can read/list all diagnostic orders. `DOCTOR` can
  read/list only orders matching their authenticated identity.
- Parent and items are created through Mongoose `withTransaction`; there is no
  partial-write fallback for MongoDB deployments without transaction support.
- Duplicate normalized service codes are rejected within one request, without
  preventing the same service from being ordered again later.
- A compound unique `(diagnosticOrderId, serviceCode)` index enforces the same
  rule for future model paths; duplicate-key errors become safe `409` responses.
- Date-only list filters use UTC day boundaries. Timestamp filters require an
  explicit `Z` or numeric timezone offset because no clinic timezone exists.
- Aggregate status ignores cancelled items after the all-cancelled check, then
  resolves to completed, in progress, scheduled, or ordered based on remaining
  item progress. Parent status is never client-controlled.

## Important Files

- `src/lib/diagnostic.ts`
- `src/lib/diagnostic-orders.ts`
- `src/models/DiagnosticOrder.ts`
- `src/models/DiagnosticOrderItem.ts`
- `src/app/api/diagnostic-orders/route.ts`
- `src/app/api/diagnostic-orders/[id]/route.ts`
- `src/lib/roles.ts`
- `src/models/MedicalVisit.ts`
- `src/models/Patient.ts`
- `src/models/User.ts`
- `docs/diagnostics.md`

## Deferred Work

- Diagnostic UI
- Complete diagnostic item status-transition workflow
- Lab/Imaging result workflow
- Billing and Revenue integration
- Shopify integration

## Known Issues

MongoDB transactions require a replica set or sharded deployment. The API does
not weaken atomicity for standalone MongoDB. The pre-existing production build
failure in two empty client route files remains outside this phase.

MedicalVisit has no OPEN/CLOSED/LOCKED lifecycle state. A future business
decision must define whether new diagnostics are allowed for old or clinically
finalized visits; this corrective pass intentionally does not invent a status
or age-based restriction.

Before deploying the new unique index against an existing diagnostic-items
collection, verify that no duplicate `(diagnosticOrderId, serviceCode)` pairs
already exist. Index creation will fail safely if legacy duplicates are present;
this pass does not delete or rewrite clinical records.

## Verification

- Corrective-pass focused verification confirmed request-level duplicate-code
  rejection, the named compound unique index, absence of global service-code
  uniqueness, and same-code model validation across different order IDs.
- Duplicate-key recognition maps MongoDB code `11000` to the diagnostic `409`
  conflict path. The real application database was not mutated; index behavior
  was verified through Mongoose schema metadata rather than inserting records.
- Date verification confirmed exact UTC start/end boundaries for date-only
  values, correct offset-to-instant conversion, rejection of timezone-less
  timestamps, and rejection of impossible calendar dates.
- Corrective-pass focused ESLint and TypeScript validation passed.
- Focused ESLint passed for all Diagnostic API, business logic, role, and
  aggregate-status files.
- Focused TypeScript validation passed for the new routes, services, related
  models, authentication, and role dependencies.
- The focused business-logic audit passed for LAB/IMAGING requests, one and
  multiple items, validation, protected-field rejection, normalized duplicate
  codes, role permissions, list parsing, and all required aggregate-status
  combinations. No production database data was created.
- Full `npm run lint` passed with one pre-existing unused-disable warning in
  `src/lib/db.ts`.
- `npm run build` compiled successfully, then failed its generated route type
  validation because the pre-existing `src/app/(client)/doctor-list/page.tsx`
  and `src/app/(client)/services/page.tsx` files are not modules.
- The repository defines no automated test script; the focused audit used a
  temporary harness that was removed after execution.

## Next Phase

Diagnostic Item Status-Transition API

## Recommended Next Step

Implement explicit, role-aware item status-transition operations that set the
required audit timestamps/actors and recompute parent status in the same
transaction. This small server phase should precede workflow UI so the UI never
needs an unsafe generic update endpoint.
