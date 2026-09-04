import { NextResponse } from "next/server";
import { users } from "@/app/api/_data";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) { const { id } = await params; const user = users.find((item) => item.id === id); return user ? NextResponse.json({ data: user }) : NextResponse.json({ message: "User not found" }, { status: 404 }); }
export async function PUT(request: Request, { params }: Context) { const { id } = await params; const body = await request.json().catch(() => ({})); const user = users.find((item) => item.id === id); if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 }); return NextResponse.json({ message: "User updated", data: { ...user, ...body, id } }); }
export async function DELETE(_request: Request, { params }: Context) { const { id } = await params; const user = users.find((item) => item.id === id); return user ? NextResponse.json({ message: "User deleted", data: user }) : NextResponse.json({ message: "User not found" }, { status: 404 }); }
