import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Appointment, { IAppointment } from '@/models/Appointment';

export async function GET() {
  try {
    await connectDB();
    // Liên kết thông tin Bệnh nhân và Bác sĩ
    const appointments = await Appointment.find()
      .populate('patientId', 'fullName phone')
      .populate('doctorId', 'name')
      .sort({ appointmentDate: -1 });
    return NextResponse.json({ success: true, data: appointments });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as Partial<IAppointment>;
    const newAppointment = await Appointment.create(body);
    return NextResponse.json({ success: true, data: newAppointment }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}
