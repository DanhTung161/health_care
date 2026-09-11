# Codex Handoff

## Current Phase

Diagnostic Architecture Foundation

## Completed

- Added shared diagnostic type, status, and priority constants/types.
- Added `DiagnosticOrder` for MedicalVisit-owned request metadata.
- Added separate `DiagnosticOrderItem` records for independently managed tests
  and imaging services.
- Added historical service and ordering-doctor snapshots, status audit fields,
  validation, and query indexes.
- Documented domain boundaries and future extension points.

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

## Important Files

- `src/lib/diagnostic.ts`
- `src/models/DiagnosticOrder.ts`
- `src/models/DiagnosticOrderItem.ts`
- `src/models/MedicalVisit.ts`
- `src/models/Patient.ts`
- `src/models/User.ts`
- `docs/diagnostics.md`

## Deferred Work

- Diagnostic API/business workflow
- RBAC enforcement and ownership validation
- Diagnostic UI
- Lab/Imaging result workflow
- Billing and Revenue integration
- Shopify integration

## Known Issues

The working tree already contained uncommitted Billing audit changes before
this phase; preserve and review them separately. No diagnostic-domain issue is
known from this phase.

## Verification

- Runtime Mongoose schema audit passed for defaults, normalization, references,
  indexes, invalid diagnostic types, status audit requirements, and timestamp
  ordering.
- Focused TypeScript check passed for the diagnostic constants and both models.
- Focused ESLint check passed for the diagnostic constants and both models.
- Full `npm run lint` passed with one pre-existing warning in `src/lib/db.ts`.
- `npm run build` compiled successfully, then failed Next.js route type
  validation because the pre-existing `src/app/(client)/doctor-list/page.tsx`
  and `src/app/(client)/services/page.tsx` files are not modules. This is
  outside the diagnostic foundation scope.
- The repository defines no automated test script.

## Next Phase

Diagnostic API + RBAC

## Recommended Next Step

Implement one transactional create-order endpoint that loads the MedicalVisit,
derives Patient and ordering-doctor ownership from authenticated server data,
creates at least one item, and never accepts audit identities from the client.
