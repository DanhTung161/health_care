import { NextResponse } from "next/server";
import { appointments } from "@/app/api/_data";

export async function GET() { return NextResponse.json({ data: appointments, total: appointments.length }); }
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); const appointment = { id: "a-004", patientId: body.patientId ?? "p-001", doctorId: body.doctorId ?? "d-001", date: body.date ?? "2026-09-06", time: body.time ?? "09:00", status: body.status ?? "scheduled", reason: body.reason ?? "Khám tổng quát" }; return NextResponse.json({ message: "Appointment created", data: appointment }, { status: 201 }); }
