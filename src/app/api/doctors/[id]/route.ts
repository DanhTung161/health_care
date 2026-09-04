import { NextResponse } from "next/server";
import { doctors } from "@/app/api/_data";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) { const { id } = await params; const doctor = doctors.find((item) => item.id === id); return doctor ? NextResponse.json({ data: doctor }) : NextResponse.json({ message: "Doctor not found" }, { status: 404 }); }
export async function PUT(request: Request, { params }: Context) { const { id } = await params; const body = await request.json().catch(() => ({})); const doctor = doctors.find((item) => item.id === id); if (!doctor) return NextResponse.json({ message: "Doctor not found" }, { status: 404 }); return NextResponse.json({ message: "Doctor updated", data: { ...doctor, ...body, id } }); }
export async function DELETE(_request: Request, { params }: Context) { const { id } = await params; const doctor = doctors.find((item) => item.id === id); return doctor ? NextResponse.json({ message: "Doctor deleted", data: doctor }) : NextResponse.json({ message: "Doctor not found" }, { status: 404 }); }
