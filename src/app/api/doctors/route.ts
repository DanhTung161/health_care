import { NextRequest, NextResponse } from 'next/server';
import type { Filter } from 'mongodb';
import connectDB from '@/lib/db';
import User, { IUser } from '@/models/User';

type FilterQuery<T> = Filter<T>;

export async function GET() {
  try {
    await connectDB();
    // Chỉ lấy user có role DOCTOR và populate chuyên khoa
    const query: FilterQuery<IUser> = { role: 'DOCTOR' };
    const doctors = await User.find(query).populate('specialtyId', 'name').sort({ name: 1 });
    return NextResponse.json({ success: true, data: doctors });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as Partial<IUser>;
    body.role = 'DOCTOR'; // Ép kiểu role
    const newDoctor = await User.create(body);
    return NextResponse.json({ success: true, data: newDoctor }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}
