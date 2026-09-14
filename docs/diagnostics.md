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
item workflow service. An order must not become `COMPLETED` while any active
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

Result UI remains intentionally deferred. The Result foundation below
references each individual `DiagnosticOrderItem` rather than adding a universal
result field to it. `COMPLETED` means that the diagnostic service workflow
completed; it does not imply that a Result has been entered, finalized,
approved, or published.

## Result architecture

Lab and Imaging use separate logical-result and revision collections:
`LabResult` / `LabResultRevision` and `ImagingResult` /
`ImagingResultRevision`. Each logical result has one immutable
`DiagnosticOrderItem` reference and is unique within its result type. The API
loads the item and dispatches from its stored `LAB` or `IMAGING` type; it never
accepts a client-selected result type. It also rejects a conflicting result in
the other collection because MongoDB cannot enforce mutual exclusion across
two collections. Result content lives only in revisions, keeping Lab analytes
structurally separate from Imaging reports.

A logical result stores `latestRevisionVersion`, identifying its newest working
revision, and optional `currentFinalVersion`, identifying the currently
effective finalized revision. Both resolve through the unique `(resultId,
version)` revision index. Keeping both pointers lets a correction draft exist
without displacing the last finalized clinical result. The API creates the
logical result and version 1 together, and advances pointers with their related
revision writes in one transaction using expected prior versions to prevent
concurrent version races.

Revision lifecycle is intentionally only `DRAFT` and `FINAL`. Draft clinical
content may be edited. Finalization requires server-derived `finalizedBy` and
`finalizedAt`; after that, clinical content and finalization audit are immutable
through the Result service. A correction creates version N+1 with a
required reason and reference to the revision it corrects. The prior revision
remains unchanged and `FINAL`; once the correction is finalized,
`currentFinalVersion` advances. There is no ambiguous `CORRECTED` state and no
destructive replacement. Schema validation enforces audit-field consistency,
correction metadata shape, and integer versions, while cross-document state,
latest-version selection, and finalized immutability remain transactional API
responsibilities.

Lab revisions contain zero or more analytes while in draft and require at least
one for finalization. Each analyte snapshots an optional code, name, original
string value, optional unit, optional textual reference range, and explicit
`NORMAL | HIGH | LOW | ABNORMAL | CRITICAL | UNKNOWN` interpretation. String
values preserve numeric-looking, inequality, categorical, and textual results;
the model neither converts values nor calculates ranges or abnormality. An
optional clinical comment is distinct from correction reasons and workflow
notes.

Imaging revisions keep required-on-finalization `findings` and `impression`
separate, with optional technique, comparison, and recommendation. No modality
enum is duplicated: the immutable item service code/name identify X-Ray,
Ultrasound, CT, MRI, or a future imaging service without constraining the result
schema to a fixed catalog.

`createdBy`, `updatedBy`, `finalizedBy`, and their timestamps are Result audit
data that the APIs derive from authenticated active Users. Revision
`createdBy`/`createdAt` also identify who initiated a correction and when; the
correction reason and prior-revision link complete that audit trail. Current
roles cannot reliably identify technicians, pathologists, or radiologists.
Result authorship and actual diagnostic performance therefore remain distinct:
Result APIs never read or change `DiagnosticOrderItem.performedBy` and never
infer an author from it.

Result entry and draft editing accept only items in `IN_PROGRESS` or
`COMPLETED` and reject `ORDERED`, `SCHEDULED`, and `CANCELLED`. Finalization and
correction require a `COMPLETED` item, but never transition it. Thus item
`COMPLETED` with a Result `DRAFT` remains valid and the item and Result state
machines stay separate.

No Result delete workflow exists. Final revisions are permanent clinical
history; corrections supersede them only through the logical finalized-version
pointer. A future decision may define safe abandonment of drafts. Attachments,
DICOM, images, PDFs, and other files belong in future external storage with
metadata references, not binary or Base64 fields in these MongoDB documents.

## Result API and authorization

Results use one item-scoped route family whose payload is selected from the
stored item type:

- `POST /api/diagnostic-orders/[orderId]/items/[itemId]/result` creates the
  logical Result and revision 1 `DRAFT`.
- `GET /api/diagnostic-orders/[orderId]/items/[itemId]/result` returns the
  logical metadata, latest revision, and current `FINAL` revision when it is a
  different version.
- `GET /api/diagnostic-orders/[orderId]/items/[itemId]/result/history` returns
  revisions oldest-first with bounded `page` and `limit` pagination (default
  50, maximum 100).
- `PATCH /api/diagnostic-orders/[orderId]/items/[itemId]/result/draft` fully
  replaces the current type-specific draft content.
- `POST /api/diagnostic-orders/[orderId]/items/[itemId]/result/finalize`
  finalizes the latest draft; its body must be empty.
- `POST /api/diagnostic-orders/[orderId]/items/[itemId]/result/corrections`
  creates the next draft from the current final content and accepts only a
  non-empty `correctionReason`.

`ADMIN` and `STAFF` have read-only access to all Results. A `DOCTOR` can read
and perform all Result mutations only for DiagnosticOrders whose immutable
`orderedByDoctorId` matches that Doctor. This is a conservative temporary
clinical-author policy until specialist roles exist: administrative privilege
does not imply authority to author or finalize clinical content. Every mutation
revalidates that the Doctor still exists, is active, and retains the
authenticated role.

Create and draft-edit bodies use strict type-specific allowlists. Lab drafts
contain `analytes` and optional `clinicalComment`; Imaging drafts contain
`findings`, `impression`, and the optional report sections. Audit fields,
ownership, status, version, correction metadata, and type selectors are
rejected. Drafts may be incomplete, while finalization additionally requires
at least one Lab analyte or non-empty Imaging findings and impression.

Draft edits do not create versions. The current draft response exposes a
`revisionToken` formed as `<revisionId>:<documentVersion>` and the response
returns it as the strong ETag `"<revisionId>:<documentVersion>"`. Draft edit and
finalization require that exact quoted value in `If-Match`; weak, malformed,
multiple, or incomplete tags are rejected. The conditional revision update
predicates on the token's revision `_id`, logical Result ownership, the current
clinical revision version, `DRAFT` status, and its Mongoose document version.
Each successful mutation increments the document version. Consequently, a
stale token cannot overwrite the same revision or alias a newer correction
revision whose document version also began at zero; conflicts return `409`.

Finalization changes only the latest `DRAFT` to `FINAL`, derives
`finalizedBy`, `finalizedAt`, and `updatedBy` on the server, and advances
`currentFinalVersion` in the same transaction. No API can edit a `FINAL`
revision. A correction is the only supported change after finalization: the
server copies the current final's clinical content into version N+1 `DRAFT`,
records its source and reason, advances only `latestRevisionVersion`, and keeps
the previous `currentFinalVersion` readable until the correction is finalized.
Expected logical-pointer predicates and unique `(resultId, version)` indexes
turn concurrent correction or pointer races into safe `409` responses.

If an item becomes `CANCELLED`, an existing draft remains readable for audit,
but it cannot be edited or finalized and is never deleted. There is currently
no abandon/revert operation for an initial or correction draft; that business
policy remains deferred.

A lower-severity concurrency edge remains when Result creation or draft editing
on an `IN_PROGRESS` item overlaps the separate item transition to `CANCELLED`.
The Result transaction reads but does not update the item document, while the
workflow transaction writes the item and not the Result, so MongoDB need not
produce a write conflict between them. The committed Result is preserved for
audit and later Result mutations observe `CANCELLED`, but an overlapping write
may finish after cancellation. This phase does not add an item workflow version
or otherwise redesign DiagnosticOrderItem concurrency. Finalization is not
affected because it requires terminal item status `COMPLETED`.

## Future Billing boundary

Future Billing charges should reference `DiagnosticOrderItem._id`, because the
item is the actual billable service and supports partial completion or
cancellation. Billing must remain a separate domain and must not infer prices
from diagnostic clinical records.

## Deferred

- Result UI, reporting, approval, and publication rules
- Diagnostic UI and dashboards
- Diagnostic workforce/technician role model
- Service catalog and pricing
- Billing/Revenue integration
- Shopify integration
- MedicalVisit lifecycle policy for old or clinically finalized visits
- Medical-image and report-file storage
