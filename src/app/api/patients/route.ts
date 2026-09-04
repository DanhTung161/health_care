import { NextResponse } from "next/server";
import { patients } from "@/app/api/_data";

export async function GET() {
  return NextResponse.json({ data: patients, total: patients.length });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const patient = { id: "p-004", name: body.name ?? "Phạm Gia Huy", age: body.age ?? 42, gender: body.gender ?? "Nam", phone: body.phone ?? "0904 567 890", diagnosis: body.diagnosis ?? "Khám tổng quát" };
  return NextResponse.json({ message: "Patient created", data: patient }, { status: 201 });
}
