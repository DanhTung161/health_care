# Diagnostic Domain Foundation

## Architecture

Diagnostics use an order-and-items design. A `DiagnosticOrder` is one doctor's
request from an existing `MedicalVisit`; separate `DiagnosticOrderItem`
documents represent the requested tests or imaging services. An order is
homogeneous: either `LAB` or `IMAGING`. X-Ray is an imaging service, not a
separate domain.

Separate items were selected over embedded subdocuments because individual
services need independent status, scheduling, cancellation, future results,
reporting, and Billing references. This also avoids write contention and an
ever-growing order document. It costs one additional query/transaction when an
order is created, which the next API phase must handle.

## Ownership and integrity

The relationship is `Patient -> MedicalVisit -> DiagnosticOrder ->
DiagnosticOrderItem`. `patientId` is intentionally repeated on the order to
support direct patient-history queries. The Diagnostic API must derive it from
the referenced MedicalVisit and reject any mismatch. It must likewise derive or
validate `orderedByDoctorId` against the authenticated doctor and MedicalVisit.
`orderedByDoctorName` is an immutable historical snapshot because User records
may later change or be removed.

Order items repeat `type` for efficient Lab/Imaging work queues. The API must
derive it from the parent order rather than accepting an unrelated value.

## API and authorization

`POST /api/diagnostic-orders` is limited to an active `DOCTOR`. The authenticated
doctor must match the MedicalVisit's immutable `doctorId`. The API loads that
MedicalVisit, derives `patientId`, verifies that the referenced Patient exists
and is not archived, reloads the active Doctor record, and derives every audit
and ownership field. Client-supplied ownership, audit, item type, timestamps,
or parent status fields are rejected.

`GET /api/diagnostic-orders` and `GET /api/diagnostic-orders/[id]` are available
to `ADMIN`, `STAFF`, and `DOCTOR`. Administrators and staff can read all orders;
doctors are restricted to orders whose `orderedByDoctorId` matches their
authenticated identity. The list endpoint is bounded and supports patient,
MedicalVisit, type, status, ordering-doctor, ordered-date range, and pagination
filters.

Date-only `from` and `to` values use UTC calendar boundaries: `from=YYYY-MM-DD`
means 00:00:00.000Z and `to=YYYY-MM-DD` means 23:59:59.999Z. Timestamp values
must be ISO timestamps with an explicit `Z` or numeric timezone offset; local or
otherwise timezone-less timestamps are rejected. The repository has no clinic
timezone setting, so the API does not infer one.

Order creation uses the repository's existing Mongoose `withTransaction`
strategy. The order and all items commit together, with no partial-write
fallback. Consequently, writes require a transaction-capable MongoDB replica
set or sharded deployment; a standalone MongoDB instance will reject creation
rather than permit inconsistent clinical data.

## Services, status, and results

No diagnostic service catalog currently exists. Each item therefore stores
immutable `serviceCode` and `serviceName` snapshots. A future catalog reference
may be added, but historical records must continue using these snapshots.
Pricing is intentionally absent.

Service codes are normalized to uppercase and must be unique within a single
DiagnosticOrder. The create validator rejects duplicates before persistence,
and the compound unique index on `(diagnosticOrderId, serviceCode)` protects the
same invariant for future model write paths. The code is not globally unique,
so the same service may be ordered again in another order.

Item status is authoritative for partial completion and cancellation. The
order status is a denormalized aggregate maintained transactionally by the
future workflow service. An order must not become `COMPLETED` while any active
item remains `ORDERED`, `SCHEDULED`, or `IN_PROGRESS`; all-cancelled orders become
`CANCELLED`. No hard-delete workflow is intended for either clinical record.

The aggregate rule is deterministic: all cancelled becomes `CANCELLED`; all
non-cancelled items completed becomes `COMPLETED`; any completed or in-progress
item while unfinished work remains becomes `IN_PROGRESS`; otherwise any
scheduled item becomes `SCHEDULED`; remaining combinations become `ORDERED`.
Cancelled items are ignored after the all-cancelled check. New orders are
derived from their initial `ORDERED` items, and no API accepts parent status.

## Item workflow transitions

`PATCH /api/diagnostic-orders/[orderId]/items/[itemId]/status` is the only item
workflow mutation endpoint. It accepts a strict transition-specific body and
rejects arbitrary item, ownership, parent-status, timestamp, and audit fields.
The legal transitions are:

- `ORDERED -> SCHEDULED | IN_PROGRESS | CANCELLED`
- `SCHEDULED -> IN_PROGRESS | CANCELLED`
- `IN_PROGRESS -> COMPLETED | CANCELLED`
- `COMPLETED` and `CANCELLED` are terminal

Repeated, backwards, and direct `ORDERED/SCHEDULED -> COMPLETED` requests return
`409 Conflict` without rewriting audit timestamps.

The current role model has no Lab or Radiology technician role, so permissions
remain deliberately narrow. The assigned `DOCTOR` may execute every legal
workflow transition on their own order. `STAFF` and `ADMIN` may schedule or
cancel any item, but may not start or complete it and are not recorded as
clinical performers. Every mutation also revalidates that the authenticated
User still exists, is active, and retains the authenticated role.

Scheduling requires `scheduledAt` as an ISO timestamp with an explicit `Z` or
numeric offset. Timezone-less timestamps are rejected, no clinic timezone is
inferred, and past scheduling is not rejected without a business rule. A
scheduled item cannot start before `scheduledAt`. Direct `ORDERED ->
IN_PROGRESS` remains valid without a schedule.

`startedAt` and `completedAt` use server time. Item `updatedBy` always records
the authenticated workflow actor. `performedBy` has a different meaning: it is
the actual person who performed the diagnostic service. Because the current
role/workforce model cannot identify that person reliably, status transitions
never infer or fill `performedBy`; any existing legitimate value is preserved.
Performer identity remains deferred. Cancellation requires a trimmed reason of
at most 1,000 characters and sets server-derived `cancelledAt`, `cancelledBy`,
and `updatedBy`; prior scheduling/start/performer history is preserved.

An item update uses its expected current status in the database predicate, so
a stale transition cannot overwrite a newer state. A mismatch returns `409`.
The conditional item update, sibling-status read, aggregate calculation, and
parent status update all run in one MongoDB transaction. Parent `updatedBy`
records the latest successful child-workflow actor on every transition, even
when the aggregate status itself remains unchanged. Concurrent sibling updates
therefore converge through transaction conflict handling rather than leaving
the item and aggregate states intentionally inconsistent.

Results are intentionally deferred. Future Lab results should use structured
analyte/value/unit/reference-range data, while Imaging should use findings and
impression structures. Those result records should reference the individual
`DiagnosticOrderItem`, rather than adding one universal result field here. In
this phase, `COMPLETED` means that the diagnostic service workflow completed;
it does not imply that a result record has been entered, approved, or published.

## Future Billing boundary

Future Billing charges should reference `DiagnosticOrderItem._id`, because the
item is the actual billable service and supports partial completion or
cancellation. Billing must remain a separate domain and must not infer prices
from diagnostic clinical records.

## Deferred

- Lab and Imaging result models/workflows
- Result audit, correction, approval, and publication rules
- Diagnostic UI and dashboards
- Service catalog and pricing
- Billing/Revenue integration
- Shopify integration
- MedicalVisit lifecycle policy for old or clinically finalized visits
