import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import { PAYMENT_STATUSES } from "@/models/Billing";
import Billing from "@/models/Billing";
import Patient from "@/models/Patient";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type PopulatedPatient = { _id: mongoose.Types.ObjectId; fullName: string; phone?: string };
type PopulatedDoctor = { _id: mongoose.Types.ObjectId; name: string };
type PopulatedAppointment = {
  _id: mongoose.Types.ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  status: string;
  doctorId?: PopulatedDoctor | null;
};
type BillingListRecord = {
  _id: mongoose.Types.ObjectId;
  invoiceNo: string;
  grossSubtotal: number;
  effectiveInsurancePaid: number;
  totalPatientPayable: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  insuranceVerificationStatus: string;
  patientId: PopulatedPatient | null;
  appointmentId: PopulatedAppointment | null;
};

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: Billing is limited to ADMIN and STAFF",
    },
    { status },
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function serializeRecord(record: BillingListRecord) {
  return {
    id: record._id.toString(),
    invoiceNo: record.invoiceNo,
    grossSubtotal: record.grossSubtotal,
    effectiveInsurancePaid: record.effectiveInsurancePaid,
    totalPatientPayable: record.totalPatientPayable,
    amountPaid: record.amountPaid,
    balanceDue: record.balanceDue,
    paymentStatus: record.paymentStatus,
    insuranceVerificationStatus: record.insuranceVerificationStatus,
    patient: record.patientId
      ? {
          id: record.patientId._id.toString(),
          fullName: record.patientId.fullName,
          phone: record.patientId.phone ?? null,
        }
      : null,
    appointment: record.appointmentId
      ? {
          id: record.appointmentId._id.toString(),
          appointmentDate: record.appointmentId.appointmentDate.toISOString(),
          timeSlot: record.appointmentId.timeSlot,
          status: record.appointmentId.status,
          doctorName: record.appointmentId.doctorId?.name ?? null,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return authorizationError(403);
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const requestedStatus =
    request.nextUrl.searchParams.get("paymentStatus")?.trim() ?? "";
  if (
    requestedStatus &&
    !PAYMENT_STATUSES.includes(
      requestedStatus as (typeof PAYMENT_STATUSES)[number],
    )
  ) {
    return NextResponse.json(
      { success: false, error: "Payment status filter is invalid" },
      { status: 400 },
    );
  }

  const requestedPage = positiveInteger(
    request.nextUrl.searchParams.get("page"),
    1,
  );
  const limit = Math.min(
    positiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  try {
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (requestedStatus) filter.paymentStatus = requestedStatus;

    if (search) {
      const expression = new RegExp(escapeRegex(search.slice(0, 200)), "i");
      const patientIds = await Patient.find({
        $or: [{ fullName: expression }, { phone: expression }],
      })
        .select("_id")
        .lean();
      filter.$or = [
        { invoiceNo: expression },
        { patientId: { $in: patientIds.map(({ _id }) => _id) } },
      ];
    }

    const total = await Billing.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);
    const records = (await Billing.find(filter)
      .select(
        "invoiceNo grossSubtotal effectiveInsurancePaid totalPatientPayable amountPaid balanceDue paymentStatus insuranceVerificationStatus patientId appointmentId",
      )
      .populate({ path: "patientId", select: "fullName phone" })
      .populate({
        path: "appointmentId",
        select: "appointmentDate timeSlot status doctorId",
        populate: { path: "doctorId", select: "name" },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()) as unknown as BillingListRecord[];

    return NextResponse.json({
      success: true,
      data: {
        items: records.map(serializeRecord),
        pagination: { page, limit, total, totalPages },
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load invoices" },
      { status: 500 },
    );
  }
}
