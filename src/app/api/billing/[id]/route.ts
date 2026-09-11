import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import Billing from "@/models/Billing";

type RouteContext = { params: Promise<{ id: string }> };
type IdName = { _id: mongoose.Types.ObjectId; name: string };
type DetailRecord = {
  _id: mongoose.Types.ObjectId;
  invoiceNo: string;
  lookupCode: string;
  createdAt: Date;
  appointmentId: {
    _id: mongoose.Types.ObjectId;
    appointmentDate: Date;
    timeSlot: string;
    status: string;
    reason?: string;
    doctorId?: IdName | null;
  } | null;
  patientId: { _id: mongoose.Types.ObjectId; fullName: string; phone?: string } | null;
  lineItems: Array<{
    _id: mongoose.Types.ObjectId;
    category: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    isCoveredByInsurance: boolean;
    paymentStatus: string;
    createdAt: Date;
  }>;
  paymentTransactions: Array<{
    _id: mongoose.Types.ObjectId;
    amount: number;
    method: string;
    type: string;
    reference?: string;
    note?: string;
    collectedBy: IdName | null;
    collectedAt: Date;
  }>;
  insurancePlan: string;
  grossSubtotal: number;
  coveredSubtotal: number;
  calculatedInsurancePaid: number;
  insuranceOverrideEnabled: boolean;
  insuranceOverrideAmount: number;
  effectiveInsurancePaid: number;
  postInsuranceAmount: number;
  vatAmount: number;
  totalPatientPayable: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  insuranceVerificationStatus: string;
  insuranceNote?: string;
  verifiedBy?: IdName | null;
  verifiedAt?: Date;
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

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return authorizationError(403);
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid invoice id" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const billing = (await Billing.findById(id)
      .populate({ path: "patientId", select: "fullName phone" })
      .populate({
        path: "appointmentId",
        select: "appointmentDate timeSlot status reason doctorId",
        populate: { path: "doctorId", select: "name" },
      })
      .populate({ path: "paymentTransactions.collectedBy", select: "name" })
      .populate({ path: "verifiedBy", select: "name" })
      .lean()) as unknown as DetailRecord | null;
    if (!billing) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: billing._id.toString(),
        invoiceNo: billing.invoiceNo,
        lookupCode: billing.lookupCode,
        invoiceDate: billing.createdAt.toISOString(),
        appointment: billing.appointmentId
          ? {
              id: billing.appointmentId._id.toString(),
              appointmentDate: billing.appointmentId.appointmentDate.toISOString(),
              timeSlot: billing.appointmentId.timeSlot,
              status: billing.appointmentId.status,
              reason: billing.appointmentId.reason ?? null,
              doctorName: billing.appointmentId.doctorId?.name ?? null,
            }
          : null,
        patient: billing.patientId
          ? {
              id: billing.patientId._id.toString(),
              fullName: billing.patientId.fullName,
              phone: billing.patientId.phone ?? null,
            }
          : null,
        lineItems: billing.lineItems.map((item) => ({
          id: item._id.toString(),
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          isCoveredByInsurance: item.isCoveredByInsurance,
          paymentStatus: item.paymentStatus,
          createdAt: item.createdAt.toISOString(),
        })),
        paymentTransactions: billing.paymentTransactions.map((transaction) => ({
          id: transaction._id.toString(),
          amount: transaction.amount,
          method: transaction.method,
          type: transaction.type,
          reference: transaction.reference ?? null,
          note: transaction.note ?? null,
          collectedBy: transaction.collectedBy
            ? {
                id: transaction.collectedBy._id.toString(),
                name: transaction.collectedBy.name,
              }
            : null,
          collectedAt: transaction.collectedAt.toISOString(),
        })),
        insurance: {
          plan: billing.insurancePlan,
          grossSubtotal: billing.grossSubtotal,
          coveredSubtotal: billing.coveredSubtotal,
          calculatedInsurancePaid: billing.calculatedInsurancePaid,
          overrideEnabled: billing.insuranceOverrideEnabled,
          overrideAmount: billing.insuranceOverrideAmount,
          effectiveInsurancePaid: billing.effectiveInsurancePaid,
          postInsuranceAmount: billing.postInsuranceAmount,
          verificationStatus: billing.insuranceVerificationStatus,
          note: billing.insuranceNote ?? null,
          verifiedBy: billing.verifiedBy
            ? { id: billing.verifiedBy._id.toString(), name: billing.verifiedBy.name }
            : null,
          verifiedAt: billing.verifiedAt?.toISOString() ?? null,
        },
        totals: {
          vatAmount: billing.vatAmount,
          totalPatientPayable: billing.totalPatientPayable,
          amountPaid: billing.amountPaid,
          balanceDue: billing.balanceDue,
          paymentStatus: billing.paymentStatus,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load invoice" },
      { status: 500 },
    );
  }
}
