export const PATIENT_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const PATIENT_LIST_STATES = ["active", "archived", "all"] as const;
export const PATIENT_SORT_FIELDS = [
  "fullName",
  "phone",
  "gender",
  "dateOfBirth",
  "createdAt",
  "deletedAt",
] as const;

export type PatientGender = (typeof PATIENT_GENDERS)[number];
export type PatientListState = (typeof PATIENT_LIST_STATES)[number];
export type PatientSortField = (typeof PATIENT_SORT_FIELDS)[number];

export interface PatientInput {
  fullName?: string;
  phone?: string;
  identityCard?: string;
  gender?: PatientGender | null;
  dateOfBirth?: Date | null;
  address?: string;
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): { value: number } | { error: string } {
  if (value === null) return { value: fallback };
  if (!/^\d+$/.test(value)) {
    return { error: "Pagination values must be positive integers" };
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    return { error: "Pagination value is out of range" };
  }

  return { value: parsed };
}

export function parsePatientInput(
  value: unknown,
  partial = false,
): { data: PatientInput } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  const allowed = new Set([
    "fullName",
    "phone",
    "identityCard",
    "gender",
    "dateOfBirth",
    "address",
  ]);
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowed.has(key))) {
    return { error: "Invalid request body" };
  }

  const data: PatientInput = {};
  for (const field of ["fullName", "phone", "identityCard", "address"] as const) {
    if (!(field in body)) continue;
    if (typeof body[field] !== "string") {
      return { error: `${field} must be a string` };
    }

    const normalized = body[field].trim();
    if ((field === "fullName" || field === "phone") && !normalized) {
      return { error: `${field} is required` };
    }
    data[field] = normalized;
  }

  if ("gender" in body) {
    if (typeof body.gender !== "string") return { error: "Gender is invalid" };
    if (!body.gender) data.gender = null;
    else if (PATIENT_GENDERS.includes(body.gender as PatientGender)) {
      data.gender = body.gender as PatientGender;
    } else return { error: "Gender is invalid" };
  }

  if ("dateOfBirth" in body) {
    if (typeof body.dateOfBirth !== "string") {
      return { error: "Date of birth is invalid" };
    }

    if (!body.dateOfBirth.trim()) data.dateOfBirth = null;
    else {
      const date = new Date(body.dateOfBirth);
      if (Number.isNaN(date.getTime())) return { error: "Date of birth is invalid" };
      data.dateOfBirth = date;
    }
  }

  if (!partial && (!data.fullName || !data.phone)) {
    return { error: "fullName and phone are required" };
  }
  if (partial && !Object.keys(data).length) {
    return { error: "No patient changes were provided" };
  }

  return { data };
}

export function buildPatientListQuery({
  search,
  state,
  gender,
}: {
  search: string;
  state: PatientListState;
  gender: PatientGender | "all";
}): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];

  if (state === "active") clauses.push({ deletedAt: null });
  else if (state === "archived") {
    clauses.push({ deletedAt: { $type: "date" } });
  }

  if (gender !== "all") clauses.push({ gender });
  if (search) {
    clauses.push({
      $or: ["fullName", "phone", "identityCard"].map((field) => ({
        [field]: { $regex: escapeRegex(search), $options: "i" },
      })),
    });
  }

  return clauses.length ? { $and: clauses } : {};
}

export function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
