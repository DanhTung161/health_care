export const MEDICAL_VISIT_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface PrescriptionInput {
  medicineName: string;
  dosage?: string;
  frequency?: string;
}

export interface MedicalVisitInput {
  visitDate?: Date;
  diagnosis?: string;
  symptoms?: string;
  prescription?: PrescriptionInput[];
  notes?: string;
}

function parseOptionalString(
  value: unknown,
  field: string,
): { value: string } | { error: string } {
  if (typeof value !== "string") return { error: `${field} must be a string` };
  return { value: value.trim() };
}

export function parseMedicalVisitInput(
  value: unknown,
  partial = false,
): { data: MedicalVisitInput } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  const allowed = new Set([
    "visitDate",
    "diagnosis",
    "symptoms",
    "prescription",
    "notes",
  ]);
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowed.has(key))) {
    return { error: "Invalid request body" };
  }

  const data: MedicalVisitInput = {};
  if ("visitDate" in body) {
    if (typeof body.visitDate !== "string" || !body.visitDate.trim()) {
      return { error: "Visit date is invalid" };
    }
    const visitDate = new Date(body.visitDate);
    if (Number.isNaN(visitDate.getTime())) return { error: "Visit date is invalid" };
    data.visitDate = visitDate;
  }

  if ("diagnosis" in body) {
    const diagnosis = parseOptionalString(body.diagnosis, "Diagnosis");
    if ("error" in diagnosis) return { error: diagnosis.error };
    if (!diagnosis.value) return { error: "Diagnosis is required" };
    data.diagnosis = diagnosis.value;
  }

  for (const field of ["symptoms", "notes"] as const) {
    if (!(field in body)) continue;
    const parsed = parseOptionalString(body[field], field);
    if ("error" in parsed) return { error: parsed.error };
    data[field] = parsed.value;
  }

  if ("prescription" in body) {
    if (!Array.isArray(body.prescription)) {
      return { error: "Prescription must be an array" };
    }
    const prescription: PrescriptionInput[] = [];
    for (const item of body.prescription) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { error: "Prescription item is invalid" };
      }
      const source = item as Record<string, unknown>;
      const itemKeys = Object.keys(source);
      if (
        itemKeys.some(
          (key) => !["medicineName", "dosage", "frequency"].includes(key),
        ) ||
        typeof source.medicineName !== "string" ||
        !source.medicineName.trim()
      ) {
        return { error: "Each prescription item requires a medicine name" };
      }
      if (
        ("dosage" in source && typeof source.dosage !== "string") ||
        ("frequency" in source && typeof source.frequency !== "string")
      ) {
        return { error: "Prescription dosage and frequency must be strings" };
      }
      prescription.push({
        medicineName: source.medicineName.trim(),
        ...(typeof source.dosage === "string" && source.dosage.trim()
          ? { dosage: source.dosage.trim() }
          : {}),
        ...(typeof source.frequency === "string" && source.frequency.trim()
          ? { frequency: source.frequency.trim() }
          : {}),
      });
    }
    data.prescription = prescription;
  }

  if (!partial && !data.diagnosis) return { error: "Diagnosis is required" };
  if (partial && !Object.keys(data).length) {
    return { error: "No medical visit changes were provided" };
  }
  return { data };
}

export function isMedicalVisitEditable(createdAt: Date, now = new Date()) {
  return now.getTime() <= createdAt.getTime() + MEDICAL_VISIT_EDIT_WINDOW_MS;
}
