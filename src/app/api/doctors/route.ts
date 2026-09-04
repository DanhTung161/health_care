import { NextResponse } from "next/server";
import { doctors } from "@/app/api/_data";

export async function GET() { return NextResponse.json({ data: doctors, total: doctors.length }); }
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); const doctor = { id: "d-004", name: body.name ?? "James Wilson", specialty: body.specialty ?? "Chấn thương chỉnh hình", email: body.email ?? "james.wilson@healthnexus.com", available: body.available ?? true }; return NextResponse.json({ message: "Doctor created", data: doctor }, { status: 201 }); }
