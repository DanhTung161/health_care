import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Appointment, { IAppointment } from '@/models/Appointment';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    const appointment = await Appointment.findById(id)
      .populate('patientId', 'fullName phone gender address')
      .populate('doctorId', 'name specialtyId');
    if (!appointment) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json() as Partial<IAppointment>;
    // Thường dùng để cập nhật status (CONFIRMED / COMPLETED / CANCELLED)
    const updatedAppointment = await Appointment.findByIdAndUpdate(id, body, { new: true });
    return NextResponse.json({ success: true, data: updatedAppointment });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    await Appointment.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
