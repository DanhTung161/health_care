import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Patient, { IPatient } from '@/models/Patient';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    const patient = await Patient.findById(id);
    if (!patient) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: patient });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json() as Partial<IPatient>;
    const updatedPatient = await Patient.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    return NextResponse.json({ success: true, data: updatedPatient });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    await Patient.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
