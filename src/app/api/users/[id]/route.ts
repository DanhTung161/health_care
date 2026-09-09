import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth';
import connectDB from '@/lib/db';
import User, { IUser } from '@/models/User';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const authorization = await authorizeAdmin(_req);
    if (!authorization.ok) {
      return NextResponse.json(
        { success: false, error: authorization.status === 401 ? 'Authentication required' : 'Forbidden: administrator access required' },
        { status: authorization.status },
      );
    }

    await connectDB();
    const { id } = await params;
    const user = await User.findById(id).populate('specialtyId', 'name description')
      .select('-password'); 

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const authorization = await authorizeAdmin(req);
    if (!authorization.ok) {
      return NextResponse.json(
        { success: false, error: authorization.status === 401 ? 'Authentication required' : 'Forbidden: administrator access required' },
        { status: authorization.status },
      );
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json() as Partial<IUser>;

    if (body.password) {
      delete body.password; 
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      body, 
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedUser }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const authorization = await authorizeAdmin(_req);
    if (!authorization.ok) {
      return NextResponse.json(
        { success: false, error: authorization.status === 401 ? 'Authentication required' : 'Forbidden: administrator access required' },
        { status: authorization.status },
      );
    }

    await connectDB();
    const { id } = await params;
    const deletedUser = await User.findByIdAndDelete(id);
    
    if (!deletedUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
