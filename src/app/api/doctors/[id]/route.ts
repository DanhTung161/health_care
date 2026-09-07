import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import type { Filter } from 'mongodb';
import connectDB from '@/lib/db';
import User, { IUser } from '@/models/User';

type FilterQuery<T> = Filter<T>;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    const query: FilterQuery<IUser> = { _id: new mongoose.Types.ObjectId(id), role: 'DOCTOR' };
    const doctor = await User.findOne(query).populate('specialtyId', 'name');
    if (!doctor) return NextResponse.json({ success: false, message: 'Doctor not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: doctor });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json() as Partial<IUser>;
    const query: FilterQuery<IUser> = { _id: new mongoose.Types.ObjectId(id), role: 'DOCTOR' };
    const updatedDoctor = await User.findOneAndUpdate(query, body, { new: true });
    return NextResponse.json({ success: true, data: updatedDoctor });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const { id } = await params;
    const query: FilterQuery<IUser> = { _id: new mongoose.Types.ObjectId(id), role: 'DOCTOR' };
    await User.findOneAndDelete(query);
    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
