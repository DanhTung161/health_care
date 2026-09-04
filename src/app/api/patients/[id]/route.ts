import { NextResponse } from "next/server";
import { patients } from "@/app/api/_data";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) { const { id } = await params; const patient = patients.find((item) => item.id === id); return patient ? NextResponse.json({ data: patient }) : NextResponse.json({ message: "Patient not found" }, { status: 404 }); }
export async function PUT(request: Request, { params }: Context) { const { id } = await params; const body = await request.json().catch(() => ({})); const patient = patients.find((item) => item.id === id); if (!patient) return NextResponse.json({ message: "Patient not found" }, { status: 404 }); return NextResponse.json({ message: "Patient updated", data: { ...patient, ...body, id } }); }
export async function DELETE(_request: Request, { params }: Context) { const { id } = await params; const patient = patients.find((item) => item.id === id); return patient ? NextResponse.json({ message: "Patient deleted", data: patient }) : NextResponse.json({ message: "Patient not found" }, { status: 404 }); }
