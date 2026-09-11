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

## Services, status, and results

No diagnostic service catalog currently exists. Each item therefore stores
immutable `serviceCode` and `serviceName` snapshots. A future catalog reference
may be added, but historical records must continue using these snapshots.
Pricing is intentionally absent.

Item status is authoritative for partial completion and cancellation. The
order status is a denormalized aggregate maintained transactionally by the
future workflow service. An order must not become `COMPLETED` while any active
item remains `ORDERED`, `SCHEDULED`, or `IN_PROGRESS`; all-cancelled orders become
`CANCELLED`. No hard-delete workflow is intended for either clinical record.

Results are intentionally deferred. Future Lab results should use structured
analyte/value/unit/reference-range data, while Imaging should use findings and
impression structures. Those result records should reference the individual
`DiagnosticOrderItem`, rather than adding one universal result field here.

## Future Billing boundary

Future Billing charges should reference `DiagnosticOrderItem._id`, because the
item is the actual billable service and supports partial completion or
cancellation. Billing must remain a separate domain and must not infer prices
from diagnostic clinical records.

## Deferred

- Diagnostic CRUD APIs and transactional order creation
- RBAC and MedicalVisit/Patient/doctor consistency enforcement
- Status-transition and aggregate-status services
- Lab and Imaging result models/workflows
- Diagnostic UI and dashboards
- Service catalog and pricing
- Billing/Revenue integration
- Shopify integration
