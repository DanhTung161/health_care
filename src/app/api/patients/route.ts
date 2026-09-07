import { NextRequest, NextResponse } from 'next/server';
import type { Filter } from 'mongodb';
import connectDB from '@/lib/db';
import Patient, { IPatient } from '@/models/Patient';

type FilterQuery<T> = Filter<T>;

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    
    const query: FilterQuery<IPatient> = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [patients, total] = await Promise.all([
      Patient.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Patient.countDocuments(query)
    ]);

    return NextResponse.json({ success: true, data: patients, total, page, limit });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as Partial<IPatient>;
    const newPatient = await Patient.create(body);
    return NextResponse.json({ success: true, data: newPatient }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}
