import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  hasAppointmentConflict,
  parseAppointmentSlot,
} from "@/lib/appointment-scheduling";
import {
  canTransitionAppointmentStatus,
  isAppointmentStatus,
  isReschedulableAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import {
  ensureBillingForAppointment,
  prepareBillingPersistence,
} from "@/lib/billing";
import connectDB from "@/lib/db";
import Appointment from "@/models/Appointment";
import "@/models/Patient";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: insufficient appointment permissions",
    },
    { status },
  );
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid appointment id" },
        { status: 400 },
      );
    }
    const appointment = await Appointment.findById(id)
      .populate("patientId", "fullName phone gender address")
      .populate("doctorId", "name specialtyId")
      .populate("cancelledBy", "name email");
    if (!appointment) {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: appointment });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load appointment" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const currentUser = await authenticateRequest(req);
  if (!currentUser) return authorizationError(401);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid appointment id" },
      { status: 400 },
    );
  }

  let requestBody: unknown;
  try {
    requestBody = (await req.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const body = requestBody as Record<string, unknown>;
  const allowedFields = new Set([
    "doctorId",
    "appointmentDate",
    "timeSlot",
    "status",
    "reason",
    "cancellationReason",
  ]);
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowedFields.has(key))) {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const changesSlot = ["doctorId", "appointmentDate", "timeSlot"].some(
    (field) => field in body,
  );
  if ("status" in body && !isAppointmentStatus(body.status)) {
    return NextResponse.json(
      { success: false, error: "Invalid appointment status" },
      { status: 400 },
    );
  }
  if ("reason" in body && typeof body.reason !== "string") {
    return NextResponse.json(
      { success: false, error: "Reason must be a string" },
      { status: 400 },
    );
  }
  if ("cancellationReason" in body && typeof body.cancellationReason !== "string") {
    return NextResponse.json(
      { success: false, error: "Cancellation reason must be a string" },
      { status: 400 },
    );
  }

  const requestedStatus = body.status as AppointmentStatus | undefined;
  const cancellationReason =
    typeof body.cancellationReason === "string"
      ? body.cancellationReason.trim()
      : undefined;
  if (requestedStatus === "CANCELLED" && !cancellationReason) {
    return NextResponse.json(
      { success: false, error: "A cancellation reason is required" },
      { status: 400 },
    );
  }
  if (requestedStatus !== "CANCELLED" && "cancellationReason" in body) {
    return NextResponse.json(
      { success: false, error: "Cancellation reason can only be supplied when cancelling" },
      { status: 400 },
    );
  }
  if (requestedStatus && changesSlot) {
    return NextResponse.json(
      { success: false, error: "Status changes and rescheduling must be submitted separately" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 },
      );
    }

    const currentStatus = appointment.status as AppointmentStatus;
    if (!isAppointmentStatus(currentStatus)) {
      return NextResponse.json(
        { success: false, error: "Appointment has an invalid stored status" },
        { status: 409 },
      );
    }

    const isFrontDesk = currentUser.role === "ADMIN" || currentUser.role === "STAFF";
    const isAssignedDoctor =
      currentUser.role === "DOCTOR" &&
      appointment.doctorId.toString() === currentUser.id;

    if (currentUser.role === "DOCTOR") {
      if (
        !isAssignedDoctor ||
        requestedStatus !== "ACCEPTED" ||
        keys.some((key) => key !== "status")
      ) {
        return authorizationError(403);
      }
    } else if (!isFrontDesk) {
      return authorizationError(403);
    } else if (requestedStatus === "ACCEPTED") {
      return NextResponse.json(
        { success: false, error: "Only the assigned doctor can accept an appointment" },
        { status: 403 },
      );
    }

    if (
      requestedStatus &&
      !canTransitionAppointmentStatus(currentStatus, requestedStatus)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition an appointment from ${currentStatus} to ${requestedStatus}`,
        },
        { status: 409 },
      );
    }

    if (requestedStatus === "CANCELLED") {
      if (!cancellationReason) {
        return NextResponse.json(
          { success: false, error: "A cancellation reason is required" },
          { status: 400 },
        );
      }

      const requiredCancellationPaths = [
        "cancellationReason",
        "cancelledAt",
        "cancelledBy",
        "updatedBy",
      ];
      if (
        requiredCancellationPaths.some(
          (path) => !Appointment.schema.path(path),
        )
      ) {
        return NextResponse.json(
          { success: false, error: "Appointment cancellation is unavailable" },
          { status: 500 },
        );
      }

      const actorId = new mongoose.Types.ObjectId(currentUser.id);
      const cancelledAppointment = await Appointment.findOneAndUpdate(
        { _id: appointment._id, status: currentStatus },
        {
          $set: {
            status: "CANCELLED",
            cancellationReason,
            cancelledAt: new Date(),
            cancelledBy: actorId,
            updatedBy: actorId,
          },
        },
        { returnDocument: "after", runValidators: true },
      );

      if (!cancelledAppointment) {
        return NextResponse.json(
          {
            success: false,
            error: "Appointment status changed before cancellation could be saved",
          },
          { status: 409 },
        );
      }
      if (cancelledAppointment.cancellationReason !== cancellationReason) {
        return NextResponse.json(
          { success: false, error: "Cancellation reason could not be saved" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        data: cancelledAppointment.toObject(),
      });
    }

    if (requestedStatus === "CONFIRMED") {
      const actorId = new mongoose.Types.ObjectId(currentUser.id);
      await prepareBillingPersistence();
      const session = await mongoose.startSession();
      let confirmedAppointment: typeof appointment | null = null;

      try {
        await session.withTransaction(async () => {
          const update: Record<string, unknown> = {
            status: "CONFIRMED",
            updatedBy: actorId,
          };
          if (typeof body.reason === "string") {
            update.reason = body.reason.trim();
          }

          confirmedAppointment = await Appointment.findOneAndUpdate(
            { _id: appointment._id, status: currentStatus },
            { $set: update },
            {
              returnDocument: "after",
              runValidators: true,
              session,
            },
          );

          if (!confirmedAppointment) {
            throw new Error("APPOINTMENT_TRANSITION_CONFLICT");
          }

          await ensureBillingForAppointment({
            appointmentId: appointment._id,
            patientId: appointment.patientId,
            actorId,
            session,
          });
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "APPOINTMENT_TRANSITION_CONFLICT"
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "Appointment status changed before it could be confirmed",
            },
            { status: 409 },
          );
        }
        throw error;
      } finally {
        await session.endSession();
      }

      if (!confirmedAppointment) {
        throw new Error("Confirmed appointment was not returned");
      }

      return NextResponse.json({
        success: true,
        data: confirmedAppointment.toObject(),
      });
    }

    if (changesSlot) {
      if (!isReschedulableAppointmentStatus(currentStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `A ${currentStatus.toLowerCase()} appointment cannot be rescheduled`,
          },
          { status: 409 },
        );
      }
      const slot = parseAppointmentSlot(
        "doctorId" in body ? body.doctorId : appointment.doctorId.toString(),
        "appointmentDate" in body
          ? body.appointmentDate
          : appointment.appointmentDate.toISOString().slice(0, 10),
        "timeSlot" in body ? body.timeSlot : appointment.timeSlot,
      );
      if ("error" in slot) {
        return NextResponse.json(
          { success: false, error: slot.error },
          { status: 400 },
        );
      }
      const doctor = await User.exists({
        _id: slot.data.doctorId,
        role: "DOCTOR",
        isActive: true,
      });
      if (!doctor) {
        return NextResponse.json(
          { success: false, error: "Active doctor not found" },
          { status: 404 },
        );
      }
      if (await hasAppointmentConflict(slot.data, id)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This doctor already has an appointment at the selected date and time",
          },
          { status: 409 },
        );
      }
      appointment.doctorId = new mongoose.Types.ObjectId(slot.data.doctorId);
      appointment.appointmentDate = slot.data.appointmentDate;
      appointment.timeSlot = slot.data.timeSlot;
    }

    if (requestedStatus) {
      appointment.status = requestedStatus;
    }
    if (typeof body.reason === "string") {
      appointment.reason = body.reason.trim();
    }

    appointment.updatedBy = new mongoose.Types.ObjectId(currentUser.id);
    await appointment.save();
    return NextResponse.json({ success: true, data: appointment.toObject() });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { success: false, error: "Appointment data failed validation" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to update appointment" },
      { status: 500 },
    );
  }
}
