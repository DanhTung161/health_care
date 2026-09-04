import { NextResponse } from "next/server";
import { users } from "@/app/api/_data";

export async function GET() { return NextResponse.json({ data: users, total: users.length }); }
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); const user = { id: "u-004", name: body.name ?? "New Team Member", email: body.email ?? "new.member@healthnexus.com", role: body.role ?? "Staff", status: body.status ?? "active", lastLogin: "Never" }; return NextResponse.json({ message: "User created", data: user }, { status: 201 }); }
