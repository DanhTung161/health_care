# Codex Handoff

## Current Phase

Diagnostic Item Workflow UI Completion

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
- Added item-scoped create/read/history, current-draft edit, finalization, and
  correction Result APIs for both Lab and Imaging.
- Added strict type-specific payload validation, safe serializers, bounded
  history pagination, and cross-type conflict detection.
- Added a conservative Result RBAC policy: `ADMIN`/`STAFF` read all, while the
  assigned active `DOCTOR` reads and performs clinical Result mutations.
- Added transactional initial creation, finalization, and correction writes,
  expected-pointer predicates, unique-version conflict handling, and
  `If-Match` draft revision tokens for edit/finalize races.
- Enforced FINAL immutability through explicit operations; corrections copy the
  current FINAL content into a new DRAFT without rewriting historical versions.
- Added `/diagnostics` list and `/diagnostics/[id]` detail views inside the
  existing authenticated shell, plus a patient-detail link into the filtered
  order list.
- Added separate workflow and Result-state displays, lazy item Result loading,
  and lazy paginated revision history.
- Added type-specific Lab and Imaging draft editors, finalization confirmation,
  correction creation/editing, read-only FINAL/revision views, and explicit
  current-FINAL versus correction-DRAFT presentation.
- Added role-aware controls: `ADMIN`/`STAFF` remain read-only, and only an
  assigned `DOCTOR` sees clinical Result mutation actions.
- Added a small client API helper that preserves HTTP status, JSON errors, and
  the exact strong ETag required for revision-safe edit/finalize operations.
- Added schedule, direct-start, completion, and cancellation controls inside
  each Diagnostic Order detail item card.
- Added dedicated schedule and cancellation dialogs with local-time-to-UTC ISO
  conversion and the shared cancellation-reason length limit.
- Added exact role/ownership/state action visibility, per-item pending/error/
  success state, and explicit completion/cancellation messaging.
- Added stale-transition `409` handling with no retry and an explicit full-order
  reload action.
- Added server-response merging for updated item and parent aggregate state, and
  synchronized that item status into the existing Result panel permissions.

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
- One logical result is unique per item within each type. The Result API derives
  its path from the stored item type and checks the other collection because
  MongoDB cannot enforce mutual exclusion across the Lab and Imaging
  collections.
- `latestRevisionVersion` identifies the newest working revision;
  `currentFinalVersion` independently identifies the clinically current FINAL
  revision, allowing a correction draft without hiding the last final result.
- Revisions use only `DRAFT` and `FINAL`. FINAL revisions remain unchanged;
  corrections create version N+1 with a reason and prior-revision reference.
  No old FINAL document is rewritten to a synthetic CORRECTED state.
- Unique `(resultId, version)` indexes prevent duplicate version numbers.
  Revisions and logical version-pointer updates share one transaction, while
  expected prior-pointer predicates resolve concurrent corrections safely.
- Lab values and reference ranges are textual historical snapshots, and
  interpretation is explicitly stored rather than calculated. Imaging keeps
  findings and impression separate and reuses the item's immutable service
  snapshot rather than defining a modality catalog.
- Finalization audit uses server-derived `finalizedBy` and `finalizedAt`.
  Revision creation and update actors are separate from the ordering Doctor and
  actual performer; Result APIs derive every actor from the authenticated
  active User and never read or change item `performedBy`.
- Result entry and draft editing allow `IN_PROGRESS` or `COMPLETED` items.
  Finalization and corrections require `COMPLETED`. Result operations never
  transition the DiagnosticOrderItem state machine.
- `ADMIN` and `STAFF` have read-only Result access. Until specialist roles
  exist, only the active assigned `DOCTOR` may create/edit/finalize/correct a
  Result for their own DiagnosticOrder; administrative privilege is not
  clinical authorship authority.
- Draft editing is full content replacement and does not allocate a version.
  Its strong `If-Match` ETag binds the revision `_id` to that document's
  Mongoose `__v` as `"<revisionId>:<documentVersion>"`. Edit and finalization
  predicates include that identity/version pair, logical Result ownership,
  current clinical revision version, and `DRAFT` status. This prevents an old
  revision token from aliasing a newer correction whose `__v` also began at
  zero; stale operations return `409`.
- Initial logical Result plus revision 1, finalization plus final-pointer
  advance, and correction revision plus latest-pointer advance each run in one
  Mongoose transaction. A correction copies the server-selected current FINAL,
  records its source/reason, and leaves `currentFinalVersion` unchanged until
  the new draft is finalized.
- FINAL clinical content is not accepted by any update API. The only later
  change is a new correction revision, so prior FINAL records remain immutable.
- There is no Result hard-delete design. Final history is retained and corrected
  through new revisions; draft-abandonment policy and external file storage are
  deferred.
- Diagnostics uses thin Server Component pages for route/search parameters and
  current-user identity. Focused Client Components own list fetching, Result
  panels, forms, dialogs, and mutation state; no global client store was added.
- Order details load once, each current Result loads only when its item panel is
  opened, and revision history loads only on demand. No bulk endpoint or
  per-list-row Result request storm was introduced.
- Result UI derives the Result type from the returned item and never sends a
  type selector, version, status, pointer, performer, or audit identity.
- Draft editors submit full type-specific replacement payloads and intentionally
  omit cleared optional strings so the server clears rather than restores stale
  content.
- The exact response ETag is stored per open Result panel, sent unchanged in
  `If-Match`, and replaced after create, save, correction, or reload. A stale
  `409` is not retried; local values remain until the user confirms reload.
- A correction DRAFT and its prior current FINAL render together. The UI states
  that the prior FINAL remains clinically effective until correction
  finalization; history revisions are always read-only.
- Mutation visibility requires both role `DOCTOR` and exact ordering-Doctor ID
  ownership. `ADMIN`, `STAFF`, and an unrelated Doctor receive no clinical
  mutation controls, while server authorization remains authoritative.
- Item workflow controls remain separate from Result controls on the existing
  order-detail item card. They derive visible actions from the shared state
  machine, role, and exact ordering-Doctor ID; the server rechecks all rules.
- Workflow mutations are never optimistic. Successful responses supply both the
  updated item state and parent aggregate status, which are merged without a
  client aggregate calculation. A stale conflict instead requires refetching
  the full order before action visibility is recalculated.
- A `datetime-local` scheduling value represents browser-local time. Calendar
  components are validated and the local instant is converted with
  `toISOString()`; no `Z` is manually appended and no clinic timezone or future
  scheduling rule is invented.
- Transition requests contain only the target `status` and its applicable
  scheduling/cancellation input. The endpoint accepts no expected-source field;
  its transaction re-reads the item and conditionally writes using the stored
  current status. State-change `409` responses are not retried.
- Starting and completion never send or infer `performedBy`; all workflow audit
  timestamps and identities remain server-derived. Item completion remains
  independent from Result finalization.
- Updated item status is authoritative for the mounted Result panel.
  `IN_PROGRESS`, `COMPLETED`, and `CANCELLED` immediately update create,
  finalize, and read-only eligibility without changing Result APIs or lifecycle.

## Important Files

- `src/lib/diagnostic.ts`
- `src/lib/diagnostic-orders.ts`
- `src/lib/diagnostic-item-transitions.ts`
- `src/lib/diagnostic-results.ts`
- `src/lib/diagnostic-result-service.ts`
- `src/lib/diagnostic-result-route.ts`
- `src/lib/diagnostic-client.ts`
- `src/lib/diagnostic-workflow-ui.ts`
- `src/models/DiagnosticOrder.ts`
- `src/models/DiagnosticOrderItem.ts`
- `src/models/LabResult.ts`
- `src/models/LabResultRevision.ts`
- `src/models/ImagingResult.ts`
- `src/models/ImagingResultRevision.ts`
- `src/app/api/diagnostic-orders/route.ts`
- `src/app/api/diagnostic-orders/[id]/route.ts`
- `src/app/api/diagnostic-orders/[orderId]/items/[itemId]/status/route.ts`
- `src/app/api/diagnostic-orders/[orderId]/items/[itemId]/result/route.ts`
- `src/app/api/diagnostic-orders/[orderId]/items/[itemId]/result/history/route.ts`
- `src/app/api/diagnostic-orders/[orderId]/items/[itemId]/result/draft/route.ts`
- `src/app/api/diagnostic-orders/[orderId]/items/[itemId]/result/finalize/route.ts`
- `src/app/api/diagnostic-orders/[orderId]/items/[itemId]/result/corrections/route.ts`
- `src/app/(admin)/diagnostics/page.tsx`
- `src/app/(admin)/diagnostics/[id]/page.tsx`
- `src/components/admin/DiagnosticOrdersList.tsx`
- `src/components/admin/DiagnosticOrderDetail.tsx`
- `src/components/admin/DiagnosticResultPanel.tsx`
- `src/components/admin/LabResultEditor.tsx`
- `src/components/admin/ImagingResultEditor.tsx`
- `src/components/admin/ResultCorrectionDialog.tsx`
- `src/components/admin/ResultHistory.tsx`
- `src/components/admin/ResultRevisionView.tsx`
- `src/components/admin/DiagnosticUI.tsx`
- `src/components/admin/DiagnosticItemWorkflowActions.tsx`
- `src/components/admin/DiagnosticScheduleDialog.tsx`
- `src/components/admin/DiagnosticCancellationDialog.tsx`
- `src/lib/roles.ts`
- `src/models/MedicalVisit.ts`
- `src/models/Patient.ts`
- `src/models/User.ts`
- `docs/diagnostics.md`

## Deferred Work

- Advanced Diagnostic dashboard and reporting
- Diagnostic scheduling calendar
- Result draft abandonment/revert policy
- Result approval/publication policy
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

Result schemas cannot independently verify the referenced item's type or
prevent the same item from being referenced once in each type-specific
collection. The Result API enforces both rules, but future direct model write
paths must continue using that service boundary. The current assigned-Doctor
mutation policy is intentionally temporary because the role model still cannot
identify Lab/Radiology specialists or technicians.

Result creation or draft editing on an `IN_PROGRESS` item can overlap the
separate item transition to `CANCELLED`. The two transactions update different
documents, so the item read in the Result transaction does not guarantee a
write conflict. A Result write may therefore finish after cancellation; it is
preserved for audit, and later Result mutations reject the cancelled state.
This lower-severity edge remains documented rather than adding an item workflow
version in the Phase 5 token correction. Finalization still requires terminal
item status `COMPLETED` and is not subject to this overlap.

## Verification

- Phase 7 focused workflow verification passed without database access. It
  covered the full role/state action matrix, unrelated-Doctor denial, valid
  browser-local timestamp conversion and invalid inputs, exact transition body
  fields, cancellation input, `409` propagation with no retry, server-owned
  aggregate use, absence of performer/audit fields, and Result-status
  synchronization wiring.
- Phase 7 focused ESLint and focused TypeScript validation passed for the
  workflow helper, dialogs/actions, client helper, order detail, Result panel,
  and synchronized Result editors.
- Full `npm run lint` passed with no errors and the pre-existing unused-disable
  warning in `src/lib/db.ts`.
- The Phase 7 production build compiled successfully, then failed during
  generated route type validation only because the pre-existing empty
  `doctor-list` and `services` client pages are not modules. Next.js also
  reported the existing `middleware` convention deprecation warning.
- No browser session or live clinical-data mutation was performed. Interactive
  multi-item aggregate, role, scheduling, cancellation, and Result workflow
  scenarios remain manual browser verification work.

- Phase 6 focused ESLint passed for the new pages, Diagnostic/Result client
  components, client API helper, navigation, role-route configuration, and
  patient-detail navigation.
- Phase 6 focused TypeScript validation passed with generated `.next` types and
  unrelated routes excluded.
- A Phase 6 mocked two-context client-helper check verified that both contexts
  retained the same initial strong ETag, the first save replaced its token, the
  second save received `409` with no automatic retry, reload obtained the new
  token, and the next save sent that exact value in `If-Match`. It used no
  database or clinical data.
- Full `npm run lint` passed with no errors and the pre-existing unused-disable
  warning in `src/lib/db.ts`.
- The Phase 6 production build compiled successfully, then failed during
  generated route type validation only because the pre-existing empty
  `doctor-list` and `services` client pages are not modules. Next.js also
  reported the existing `middleware` convention deprecation warning.
- No browser session or live clinical-data mutation was performed. Interactive
  LAB/Imaging, role, cancellation, and confirmation flows remain manual browser
  verification work.

- Phase 5 isolated service verification passed without connecting to or
  mutating MongoDB. It covered Lab/Imaging initial drafts, stored-type dispatch,
  invalid item states, duplicate/cross-type conflicts, full draft edits,
  finalization requirements, correction copy/pointers, preservation of prior
  FINAL content, paginated history, and protected audit fields.
- Phase 5 RBAC verification covered assigned and unrelated Doctors, `ADMIN`,
  `STAFF`, inactive Users, and role mismatch after token issuance. The assigned
  active Doctor was the only mutation actor; read and mutation behavior were
  tested separately.
- Phase 5 concurrency inspection verified revision-token predicates for two
  edits and edit/finalize races, logical expected-pointer predicates for
  correction/finalization races, unique logical/revision indexes, transactional
  writes, and safe duplicate-key conflict mapping. No live clinical data was
  created.
- The focused Phase 5 token regression harness verified that a revision v1
  token with document version zero cannot edit or finalize correction revision
  v2 with its own document version zero. The v2 token successfully edited,
  returned an incremented token, rejected token reuse, and then finalized v2
  while advancing `currentFinalVersion`. Missing, weak, malformed, incomplete,
  ambiguous, invalid-ObjectId, fractional, negative, and unsafe-integer tags
  were rejected without database access.
- Phase 5 focused ESLint and focused TypeScript checks passed. Full
  `npm run lint` passed with no errors and the pre-existing unused-disable
  warning in `src/lib/db.ts`.
- The Phase 5 production build compiled successfully, then failed during
  generated route type validation only because the pre-existing empty
  `doctor-list` and `services` client pages are not modules. Next.js also
  reported the existing `middleware` convention deprecation warning.
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

## Phase 8: Diagnostic Billing Integration Foundation

- Added optional immutable `MedicalVisit.appointmentId`. The medical-visit API
  validates an explicitly requested Appointment against Patient, stable
  accepted/completed status, assigned active Doctor, and authenticated Doctor
  ownership. It never infers an Appointment from Patient/date heuristics.
- Added `DiagnosticService` as the server-authoritative source for normalized
  service identity, type, Billing category, safe-integer VND price, insurance
  eligibility, and active state. New orders persist the catalog service name;
  the backward-compatible client name cannot override it.
- Added standalone `Charge` with unique `(sourceType, sourceId)` identity. The
  only operational source is `DIAGNOSTIC_ORDER_ITEM`. Each Charge stores
  immutable historical financial snapshots and its linked Billing line ID.
- Extended Billing lines with optional immutable `chargeId` and `serviceCode`,
  plus independent `ACTIVE | VOID` financial status. Legacy lines remain active
  by default. The calculator excludes VOID lines without deleting them.
- New Diagnostic order creation now validates the trusted visit/Appointment,
  OPEN Billing, and active matching services, then creates the Order, all Items,
  all Charges, Billing lines, and recalculated Billing atomically.
- Diagnostic execution now requires an ACTIVE Charge, active Billing line, OPEN
  Billing, and the existing line-level paid/executable state before entering
  `IN_PROGRESS`. Missing legacy financial identity fails safely and is not
  fabricated.
- Unstarted unpaid cancellation makes the Charge and Billing line VOID. Paid or
  IN_PROGRESS cancellation marks the Charge `RECONCILIATION_REQUIRED`, retains
  the active line and transaction history, and does not generate a refund.
- Generic Doctor Billing-line mutations reject Charge-linked lines. Billing
  close rejects unresolved reconciliation-required Charges.
- DiagnosticOrderItem and Result models remain free of prices, payment state,
  revenue state, and Result-driven financial behavior. `performedBy` remains
  unrelated to Billing.
- Legacy MedicalVisits and Diagnostic items remain readable; no migration or
  historical Charge backfill is performed.

## Phase 9: Invoice Workflow and Charge Consolidation

- `Billing` is the Healthcare invoice aggregate. It already owns invoice
  identity, appointment/patient linkage, historical line items, insurance,
  Payment and Refund ledgers, calculated totals, settlement state, and the
  `OPEN | CLOSED` lifecycle. No duplicate Invoice or InvoiceItem collection was
  introduced and the Billing collection/API names were not changed.
- Appointment-to-Billing identity remains database protected by the unique
  `appointmentId` index. `invoiceNo` and `lookupCode` remain server-generated
  and uniquely indexed. Appointment, Patient, and invoice identity fields are
  explicitly immutable, including when a cached development model is reused.
- `Charge` remains the immutable source ledger; a Charge-backed Billing line is
  its historical representation inside the invoice. The unique Charge source
  and Billing-line indexes remain the database-backed exactly-once controls. No
  unique multikey index was added to the embedded Billing array.
- A reusable consolidation validator now verifies both directions of the
  Charge/Billing relationship, rejects missing or foreign Charges/lines,
  duplicate embedded Charge references, mismatched line IDs, duplicate source
  identity, snapshot divergence, and invalid ACTIVE/VOID/reconciliation state
  pairs. It does not repair or re-price inconsistent history.
- Diagnostic consolidation validates the existing invoice before adding a
  Charge and validates the reciprocal relationship again before recalculation
  and persistence. CLOSED invoices continue to reject consolidation.
- Invoice close is the finalization boundary. A close transaction re-reads the
  completed Appointment and OPEN Billing, validates all Charge-backed lines,
  recalculates persisted totals, enforces payment/refund/insurance settlement,
  blocks reconciliation-required Charges, writes current calculations, and
  performs an expected-`OPEN` close update. Concurrent financial writers touch
  the same Billing document and therefore conflict/retry rather than silently
  overwriting the close.
- Diagnostic reconciliation-required cancellation now also writes the Billing
  document even though totals do not change. This supplies the required write
  conflict with concurrent invoice close. It still preserves the active line
  and Payment/Refund history and creates no automatic Refund.
- `VOID` Charge/line history remains stored and excluded by the existing
  calculator. Charge-linked lines remain unavailable to generic Doctor edit or
  removal paths. Legacy consultation and Doctor-created non-Charge lines keep
  their existing behavior.
- Invoice detail reads expose Charge ID, service code, financial status,
  payment status, and the server actor who added each historical line. They do
  not query the current DiagnosticService catalog for historical presentation.
- Billing payment status and Billing lifecycle remain separate. The existing
  binary per-line `PENDING_PAYMENT | PAID` allocation is unchanged; a durable
  per-line partial allocation/Refund design remains a Phase 10 prerequisite.
- No reconciliation resolver, Payment/Refund redesign, Revenue behavior,
  Result coupling, UI, new role, or Shopify integration was added.

## Phase 10A: Durable Payment Allocation and Payment Workflow

- `Billing` remains the single invoice/settlement aggregate. Durable
  `paymentAllocations` are embedded beside the existing append-only Payment and
  Refund transaction histories; no Payment, Invoice, or InvoiceItem collection
  was added. Each immutable allocation has its own ObjectId plus
  `paymentTransactionId`, `billingLineItemId`, positive safe-integer
  `allocatedAmount`, and `allocatedAt`.
- Payment transactions remain cash-collection history. Payment allocations are
  the application of that collected money to patient liability. Invoice totals
  remain calculator-derived, and ACTIVE line settlement is now derived from
  durable allocations as `PENDING_PAYMENT | PARTIALLY_PAID | PAID`.
- Every allocation must resolve to a Payment and ACTIVE line in the same
  Billing. Allocation IDs and Payment/line pairs must be unique. Allocations
  for each Payment must sum exactly to that Payment, total allocations must
  equal collected Payments, and a line may not exceed its calculated
  patient-payable share. VOID lines cannot receive allocations.
- The per-line patient basis preserves the existing insurance and tax rules:
  effective insurance is consumed by oldest eligible lines first; invoice VAT
  is distributed across post-insurance line bases using safe-integer
  largest-remainder allocation; ties use `createdAt`, then line `_id`. The line
  liabilities are checked to sum exactly to `totalPatientPayable`.
- Cash is allocated by the server across ACTIVE lines in the same stable
  oldest-first order. The existing product rejects overpayment, so every new
  Payment is fully applied; no unapplied-deposit or advance-account domain was
  invented. Zero patient-liability lines are financially PAID without a cash
  allocation. Only ACTIVE/PAID service orders remain executable.
- Payment and allocation records are appended to the same Billing document and
  saved in the existing MongoDB transaction. Concurrent writers touch that
  same document and therefore conflict/retry on the current snapshot; the
  retried request rechecks balance and allocation capacity. The existing
  unique Idempotency-Key index remains authoritative. An exact replay returns
  the original Payment and allocations without appending either again; changed
  semantics with the same key remain a conflict.
- New Billing records initialize `paymentAllocations: []`. Existing Billing
  records without the field remain readable and are explicitly exposed as
  `LEGACY_UNALLOCATED`; no historical Payment-to-line relationship is inferred
  or persisted. A legacy invoice with prior financial history rejects new
  Payments and rejects close until an explicit reconciliation/migration exists.
- Invoice detail now exposes allocation state, durable allocations, and each
  line's patient-payable, allocated, and remaining amounts. Payment mutation
  responses expose the allocations created for that Payment and current line
  settlement summaries. The Billing UI was not redesigned; its line status
  type was only extended for `PARTIALLY_PAID`.
- Close retains every Phase 9 Charge, completion, payment, refund, and insurance
  check and additionally validates durable allocation identity/conservation.
  A diagnostic line with any durable partial allocation requires
  reconciliation instead of becoming VOID. CLOSED Billing continues to reject
  Payment mutation.
- Refund allocation is intentionally deferred to Phase 10B. Allocation-managed
  Billing fails closed at the Refund service boundary, so the current aggregate
  Refund calculation cannot silently invalidate allocations. Legacy Refund
  behavior remains available only for Billing that has no durable allocation
  field.
- Transaction-capable MongoDB verification passed 45 assertions covering the
  required one/many/partial/multiple Payment cases, deterministic ordering,
  insurance-adjusted liability, conservation, overpayment and over-allocation,
  idempotency conflicts/replay, concurrent payment conflict, VOID exclusion,
  Charge snapshot preservation, CLOSED rejection, close failure/success,
  legacy behavior, and diagnostic execution gating. Cleanup checks found zero
  temporary Appointments, Billings, or Charges.
- Focused ESLint and focused TypeScript (excluding only the two known empty
  client pages) passed. Full `npm run lint` passed with only the pre-existing
  unused-disable warning in `src/lib/db.ts`. The production build compiled,
  then stopped at the pre-existing generated type errors because the empty
  `doctor-list` and `services` client pages are not modules; it also printed
  the pre-existing middleware-to-proxy deprecation warning.

## Phase 10B: Refund Allocation Reversals and Reconciliation

- Billing now embeds immutable `refundAllocationReversals` containing an ID,
  Refund transaction ID, original Payment allocation ID, positive safe-integer
  VND amount, and timestamp. Original Payments and gross allocations are never
  rewritten. An optional Refund `reconciledChargeId` distinguishes explicit
  Charge reconciliation from a generic Refund, including idempotent replay.
- The calculator validates every Refund/reversal and Payment/allocation link:
  gross allocations equal gross collections; each Refund equals its reversals;
  total reversals equal total Refunds; an allocation cannot be over-reversed;
  effective allocations equal net collected money. ACTIVE line settlement is
  derived from gross allocation minus reversals against the existing
  insurance/VAT-adjusted patient liability. Historical allocations to VOID
  lines remain valid only when fully reversed.
- Generic Refund reverses the newest effective allocations first, ordered by
  allocation timestamp then ObjectId. It may span allocations and may create
  a collectible balance; subsequent Payment appends new records rather than
  restoring old allocations. It cannot target a Billing with an unresolved
  reconciliation-required Charge. Legacy invoices retain their prior narrow
  refund-due behavior without fabricated reversal history.
- One ADMIN/STAFF-only endpoint explicitly reconciles a
  `RECONCILIATION_REQUIRED` Charge. The server derives the effective amount on
  that exact line, appends a real Refund and line-targeted reversals, verifies
  the line is fully reversed, then atomically transitions the Charge and
  historical Billing line to VOID with server audit. An unpaid or otherwise
  ambiguous started diagnostic fails safely for separate financial review;
  no automatic clinical policy or fake Refund is inferred.
- Payment, Refund, Charge reconciliation, insurance changes, and close retain
  same-Billing transactional write conflicts. Refund Idempotency-Key replay
  returns the original Refund/reversals without a new write; changing Refund
  semantics, including generic versus Charge reconciliation, remains a 409.
  The existing cashier form reuses its key when retrying the same Refund after
  an ambiguous response.
  Close validates reversal conservation and preserves existing Phase 9/10A
  Charge, insurance, completion, balance, and legacy-ambiguity gates.
- A focused transaction-capable MongoDB harness passed 52 checks across full,
  partial, spanning, replayed, concurrent, and post-Refund Payments; over-refund
  and over-reversal; Charge reconciliation and close; original history; legacy
  reading; and executable gating. Temporary records and harness files were
  removed after verification.

## Next Phase

External review of Phase 10B Refund/reversal and Charge reconciliation
invariants before any further financial workflow expansion.

## Recommended Next Step

Review the Refund/reversal conservation, explicit Charge reconciliation audit,
insurance changes after financial history, and the conservative stop for
unpaid/ambiguous started diagnostics. No Revenue, Result coupling, UI redesign,
or Shopify behavior is part of this phase.
