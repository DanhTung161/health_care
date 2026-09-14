# Codex Handoff

## Current Phase

Lab / Imaging Result Foundation

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
- Added the explicit item status-transition endpoint and strict input allowlist.
- Added role- and Doctor-ownership-aware transition authorization with active
  User revalidation.
- Added server-derived workflow timestamps and audit actors while preserving
  prior scheduling and execution history.
- Added expected-status concurrency protection and transactional parent status
  recomputation after every item transition.
- Added separate Lab and Imaging logical-result models and type-specific
  revision models.
- Added structured multi-analyte Lab content and distinct Imaging findings and
  impression content.
- Added minimal DRAFT/FINAL lifecycle constants, finalization audit fields,
  correction metadata, deterministic version pointers, and uniqueness indexes.

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
- Lab and Imaging results use type-specific records referencing a
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
- Legal item transitions are `ORDERED -> SCHEDULED | IN_PROGRESS | CANCELLED`,
  `SCHEDULED -> IN_PROGRESS | CANCELLED`, and `IN_PROGRESS -> COMPLETED |
  CANCELLED`. `COMPLETED` and `CANCELLED` are terminal; repeated and backwards
  transitions conflict.
- The assigned `DOCTOR` may execute every legal workflow transition on their
  own order.
  `ADMIN` and `STAFF` may schedule or cancel, but may not start or complete and
  are not treated as clinical performers. No technician role was invented.
- Scheduling requires an explicit `Z` or numeric timezone offset. The API does
  not reject past schedules, but a scheduled item cannot start early.
- Entering `IN_PROGRESS` sets server `startedAt`, and completion sets server
  `completedAt`. `updatedBy` is the authenticated workflow actor, while
  `performedBy` means the actual diagnostic performer. Transitions do not infer
  or fill `performedBy`; existing legitimate values are preserved until the
  role/workforce model can identify performers reliably. Cancellation requires
  a reason and sets server `cancelledAt` and `cancelledBy` without erasing
  earlier workflow history.
- Item `updatedBy` records every successful transition actor. Parent `updatedBy`
  represents the latest successful child-workflow actor even if aggregate
  status remains unchanged.
- Item writes include the expected prior status. Stale, repeated, terminal, and
  otherwise illegal transitions return `409` without overwriting audit data.
- The conditional item update, sibling read, aggregate calculation, and parent
  update share one Mongoose transaction. The parent aggregate cannot be set by
  the client.
- Diagnostic item `COMPLETED` currently means service-workflow completion only;
  it does not imply result entry, approval, or publication.
- Lab and Imaging use separate logical-result and revision collections; Result
  content is never stored on DiagnosticOrderItem or forced into a universal
  payload.
- One logical result is unique per item within each type. A future API must
  validate the item type because MongoDB cannot enforce mutual exclusion across
  the Lab and Imaging collections.
- `latestRevisionVersion` identifies the newest working revision;
  `currentFinalVersion` independently identifies the clinically current FINAL
  revision, allowing a correction draft without hiding the last final result.
- Revisions use only `DRAFT` and `FINAL`. FINAL revisions remain unchanged;
  corrections create version N+1 with a reason and prior-revision reference.
  No old FINAL document is rewritten to a synthetic CORRECTED state.
- Unique `(resultId, version)` indexes prevent duplicate version numbers. Future
  APIs must create revisions and compare/update logical version pointers in one
  transaction to resolve concurrent corrections safely.
- Lab values and reference ranges are textual historical snapshots, and
  interpretation is explicitly stored rather than calculated. Imaging keeps
  findings and impression separate and reuses the item's immutable service
  snapshot rather than defining a modality catalog.
- Finalization audit uses `finalizedBy` and `finalizedAt`. Revision creation and
  update actors are separate from the ordering Doctor and actual performer;
  Result APIs must derive all actors from authenticated active Users.
- Draft content is schema-editable; FINAL immutability, item-type/status checks,
  revision-pointer consistency, and actor permissions belong to the future
  transactional Result service. Finalization should require item `COMPLETED`
  without automatically changing item state.
- There is no Result hard-delete design. Final history is retained and corrected
  through new revisions; draft-abandonment policy and external file storage are
  deferred.

## Important Files

- `src/lib/diagnostic.ts`
- `src/lib/diagnostic-orders.ts`
- `src/lib/diagnostic-item-transitions.ts`
- `src/lib/diagnostic-results.ts`
- `src/models/DiagnosticOrder.ts`
- `src/models/DiagnosticOrderItem.ts`
- `src/models/LabResult.ts`
- `src/models/LabResultRevision.ts`
- `src/models/ImagingResult.ts`
- `src/models/ImagingResultRevision.ts`
- `src/app/api/diagnostic-orders/route.ts`
- `src/app/api/diagnostic-orders/[id]/route.ts`
- `src/app/api/diagnostic-orders/[orderId]/items/[itemId]/status/route.ts`
- `src/lib/roles.ts`
- `src/models/MedicalVisit.ts`
- `src/models/Patient.ts`
- `src/models/User.ts`
- `docs/diagnostics.md`

## Deferred Work

- Diagnostic UI
- Result API and RBAC policy
- Result finalization/correction API
- Result UI and reporting
- Diagnostic workforce/technician role model
- Service Catalog
- Billing and Revenue integration
- Shopify integration
- MedicalVisit lifecycle decision
- Medical-image and report-file storage

## Known Issues

MongoDB transactions require a replica set or sharded deployment. The API does
not weaken atomicity for standalone MongoDB. The pre-existing production build
failure in two empty client route files remains outside this phase.

MedicalVisit has no OPEN/CLOSED/LOCKED lifecycle state. A future business
decision must define whether new diagnostics are allowed for old or clinically
finalized visits; this phase intentionally does not invent a status
or age-based restriction.

Before deploying the new unique index against an existing diagnostic-items
collection, verify that no duplicate `(diagnosticOrderId, serviceCode)` pairs
already exist. Index creation will fail safely if legacy duplicates are present;
this pass does not delete or rewrite clinical records.

Result schemas cannot verify the referenced item's type or prevent the same
item from being referenced once in each type-specific collection. The future
Result API must enforce item-type exclusivity transactionally. Its author and
finalizer permission policy also remains unresolved because the current roles
do not identify Lab/Radiology specialists or technicians.

## Verification

- Phase 4 in-memory model/schema verification passed without connecting to or
  mutating MongoDB. It covered multiple Lab analytes, textual values and range
  snapshots, interpretation validation, distinct Imaging findings/impression,
  DRAFT/FINAL audit rules, correction metadata, version pointers, and named
  uniqueness indexes.
- The same audit confirmed Lab/Imaging structural separation, immutable item
  ownership and revision identity, multiple revision representability,
  independent version-1 histories, no `performedBy` dependency, no financial or
  attachment fields, no Result states added to DiagnosticOrderItem, and no
  delete workflow.
- Phase 4 focused ESLint and focused TypeScript checks passed.
- Full `npm run lint` passed with no errors and the pre-existing unused-disable
  warning in `src/lib/db.ts`.
- The production build compiled successfully, then failed at generated route
  type validation only because the pre-existing empty `doctor-list` and
  `services` client pages are not modules.
- The performer-audit correction verified that start/completion set their
  server timestamps and `updatedBy` without inventing `performedBy`; an existing
  legitimate performer remains unchanged and client-supplied performer data is
  still rejected. Cancellation, state, aggregate, and stale-write behavior were
  unchanged.
- Phase 3 focused state-machine verification covered all seven allowed and all
  specified rejected transitions, including terminal/repeated requests.
- Focused input verification covered required cancellation reasons and lengths,
  required timezone-explicit scheduling, and rejection of client audit fields.
- Focused architecture inspection confirmed item/order linkage, active-role and
  Doctor-ownership checks, conditional expected-status writes, and one-session
  item/aggregate updates without a generic mutation endpoint.
- Phase 3 focused ESLint passed for the transition route, transition service,
  shared diagnostic helpers, and existing Diagnostic API service.
- Phase 3 focused TypeScript validation passed with generated `.next` types
  excluded so the two known empty client pages did not mask changed-file errors.
- Full `npm run lint` passed with the pre-existing unused-disable warning in
  `src/lib/db.ts` and no errors.
- The production build compiled successfully, then failed at generated route
  type validation only because the pre-existing empty `doctor-list` and
  `services` client pages are not modules.
- Transaction/concurrency behavior was verified without inserting clinical
  data: the item update predicates on its expected current status, and the item
  update, sibling read, aggregate calculation, and parent update share a single
  session and transaction. No live race was created against application data.
- Corrective-pass focused verification confirmed request-level duplicate-code
  rejection, the named compound unique index, absence of global service-code
  uniqueness, and same-code model validation across different order IDs.
- Duplicate-key recognition maps MongoDB code `11000` to the diagnostic `409`
  conflict path. The real application database was not mutated; index behavior
  was verified through Mongoose schema metadata rather than inserting records.
- Date verification confirmed exact UTC start/end boundaries for date-only
  values, correct offset-to-instant conversion, rejection of timezone-less
  timestamps, and rejection of impossible calendar dates.
- The focused business-logic audit passed for LAB/IMAGING requests, one and
  multiple items, validation, protected-field rejection, normalized duplicate
  codes, role permissions, list parsing, and all required aggregate-status
  combinations. No production database data was created.
- The repository defines no automated test script; the focused audit used a
  temporary harness that was removed after execution.

## Next Phase

Result API + RBAC + Finalization/Correction Workflow

## Recommended Next Step

Implement transactional, type-aware Result create/read/draft-edit/finalize and
correction operations. Derive actors server-side, validate item type/status,
and atomically advance expected logical version pointers without changing the
DiagnosticOrderItem state machine.
