import { NextResponse } from "next/server";
import { appointments } from "@/app/api/_data";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) { const { id } = await params; const appointment = appointments.find((item) => item.id === id); return appointment ? NextResponse.json({ data: appointment }) : NextResponse.json({ message: "Appointment not found" }, { status: 404 }); }
export async function PUT(request: Request, { params }: Context) { const { id } = await params; const body = await request.json().catch(() => ({})); const appointment = appointments.find((item) => item.id === id); if (!appointment) return NextResponse.json({ message: "Appointment not found" }, { status: 404 }); return NextResponse.json({ message: "Appointment updated", data: { ...appointment, ...body, id } }); }
export async function DELETE(_request: Request, { params }: Context) { const { id } = await params; const appointment = appointments.find((item) => item.id === id); return appointment ? NextResponse.json({ message: "Appointment deleted", data: appointment }) : NextResponse.json({ message: "Appointment not found" }, { status: 404 }); }
