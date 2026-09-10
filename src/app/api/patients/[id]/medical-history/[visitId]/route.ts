import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  isMedicalVisitEditable,
  MEDICAL_VISIT_EDIT_WINDOW_MS,
  parseMedicalVisitInput,
} from "@/lib/medical-visit";
import MedicalVisit from "@/models/MedicalVisit";

type RouteContext = {
  params: Promise<{ id: string; visitId: string }>;
};

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: medical visit access denied",
    },
    { status },
  );
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (user.role !== "ADMIN" && user.role !== "DOCTOR") {
    return authorizationError(403);
  }

  const { id, visitId } = await params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(visitId)) {
    return NextResponse.json(
      { success: false, error: "Invalid patient or medical visit id" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = parseMedicalVisitInput(body, true);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const visit = await MedicalVisit.findOne({ _id: visitId, patientId: id });
    if (!visit) {
      return NextResponse.json(
        { success: false, error: "Medical visit not found" },
        { status: 404 },
      );
    }

    const ownsVisit = visit.doctorId.toString() === user.id;
    if (user.role !== "ADMIN" && !ownsVisit) return authorizationError(403);

    const now = new Date();
    if (!isMedicalVisitEditable(visit.createdAt, now)) {
      return NextResponse.json(
        { success: false, error: "The 24-hour edit window has expired" },
        { status: 409 },
      );
    }

    const editCutoff = new Date(now.getTime() - MEDICAL_VISIT_EDIT_WINDOW_MS);
    const updatedVisit = await MedicalVisit.findOneAndUpdate(
      {
        _id: visitId,
        patientId: id,
        createdAt: { $gte: editCutoff },
      },
      { ...parsed.data, updatedBy: user.id },
      { new: true, runValidators: true },
    ).populate("doctorId", "name role");

    if (!updatedVisit) {
      return NextResponse.json(
        { success: false, error: "The 24-hour edit window has expired" },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, data: updatedVisit });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to update medical visit" },
      { status: 500 },
    );
  }
}
