import PatientManagement, {
  type PatientListItem,
} from "@/components/admin/PatientManagement";
import { getCurrentUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  buildPatientListQuery,
  PATIENT_GENDERS,
  PATIENT_LIST_STATES,
  PATIENT_SORT_FIELDS,
  type PatientGender,
  type PatientListState,
  type PatientSortField,
} from "@/lib/patient-management";
import Patient from "@/models/Patient";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export default async function Patients({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, currentUser] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const search = first(params.search, "").trim().slice(0, 200);

  const requestedState = first(params.status, "active");
  const state = PATIENT_LIST_STATES.includes(
    requestedState as PatientListState,
  )
    ? (requestedState as PatientListState)
    : "active";

  const requestedGender = first(params.gender, "all");
  const gender =
    requestedGender === "all" ||
    PATIENT_GENDERS.includes(requestedGender as PatientGender)
      ? (requestedGender as PatientGender | "all")
      : "all";

  const requestedSortBy = first(params.sortBy, "createdAt");
  const sortBy = PATIENT_SORT_FIELDS.includes(
    requestedSortBy as PatientSortField,
  )
    ? (requestedSortBy as PatientSortField)
    : "createdAt";
  const sortOrder = first(params.sortOrder, "desc") === "asc" ? "asc" : "desc";

  const requestedPage = Number(first(params.page, "1"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const limit = 10;
  const query = buildPatientListQuery({ search, state, gender });

  await connectDB();
  const total = await Patient.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const records = await Patient.find(query)
    .select(
      "fullName phone identityCard gender dateOfBirth address deletedAt createdAt updatedAt",
    )
    .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
    .skip((currentPage - 1) * limit)
    .limit(limit)
    .lean();
  const patients = JSON.parse(JSON.stringify(records)) as PatientListItem[];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PatientManagement
        patients={patients}
        pagination={{ page: currentPage, limit, total, totalPages }}
        query={{ search, status: state, gender, sortBy, sortOrder }}
        canManage={currentUser?.role === "ADMIN"}
      />
    </div>
  );
}
