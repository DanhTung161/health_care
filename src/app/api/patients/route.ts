import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  buildPatientListQuery,
  isDuplicateKeyError,
  parsePatientInput,
  parsePositiveInteger,
  PATIENT_GENDERS,
  PATIENT_LIST_STATES,
  PATIENT_SORT_FIELDS,
  type PatientGender,
  type PatientListState,
  type PatientSortField,
} from "@/lib/patient-management";
import Patient from "@/models/Patient";

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: administrator access required",
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  if (!(await authenticateRequest(request))) return authorizationError(401);

  const { searchParams } = new URL(request.url);
  const pageResult = parsePositiveInteger(searchParams.get("page"), 1, 1_000_000);
  const limitResult = parsePositiveInteger(searchParams.get("limit"), 10, 100);
  if ("error" in pageResult || "error" in limitResult) {
    const error =
      "error" in pageResult
        ? pageResult.error
        : "error" in limitResult
          ? limitResult.error
          : "Pagination values are invalid";
    return NextResponse.json(
      { success: false, error },
      { status: 400 },
    );
  }

  const search = (searchParams.get("search") ?? "").trim();
  const isHeaderSearch = searchParams.get("summary") === "header";
  const state = searchParams.get("status") ?? "active";
  const gender = searchParams.get("gender") ?? "all";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = searchParams.get("sortOrder") ?? "desc";

  if (search.length > 200) {
    return NextResponse.json(
      { success: false, error: "Search must be 200 characters or fewer" },
      { status: 400 },
    );
  }
  if (!PATIENT_LIST_STATES.includes(state as PatientListState)) {
    return NextResponse.json(
      { success: false, error: "Status filter is invalid" },
      { status: 400 },
    );
  }
  if (gender !== "all" && !PATIENT_GENDERS.includes(gender as PatientGender)) {
    return NextResponse.json(
      { success: false, error: "Gender filter is invalid" },
      { status: 400 },
    );
  }
  if (
    !PATIENT_SORT_FIELDS.includes(sortBy as PatientSortField) ||
    (sortOrder !== "asc" && sortOrder !== "desc")
  ) {
    return NextResponse.json(
      { success: false, error: "Sort parameter is invalid" },
      { status: 400 },
    );
  }

  const query = buildPatientListQuery({
    search,
    state: state as PatientListState,
    gender: gender as PatientGender | "all",
  });

  try {
    await connectDB();
    const total = await Patient.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limitResult.value));
    const page = Math.min(pageResult.value, totalPages);
    const patients = await Patient.find(query)
      .select(
        isHeaderSearch
          ? "fullName phone deletedAt"
          : "fullName phone identityCard gender dateOfBirth address deletedAt createdAt updatedAt updatedBy",
      )
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip((page - 1) * limitResult.value)
      .limit(limitResult.value);

    return NextResponse.json({
      success: true,
      data: patients,
      total,
      page,
      limit: limitResult.value,
      totalPages,
      pagination: { page, limit: limitResult.value, total, totalPages },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load patients" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = parsePatientInput(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const patient = await Patient.create({ ...parsed.data, deletedAt: null });
    return NextResponse.json(
      {
        success: true,
        data: {
          _id: patient._id.toString(),
          fullName: patient.fullName,
          phone: patient.phone,
          identityCard: patient.identityCard,
          gender: patient.gender,
          dateOfBirth: patient.dateOfBirth,
          address: patient.address,
          deletedAt: patient.deletedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: "A patient with this phone number already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to create patient" },
      { status: 500 },
    );
  }
}
