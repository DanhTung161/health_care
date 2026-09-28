import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Specialty from "@/models/Specialty";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  const specialtyId = request.nextUrl.searchParams.get("specialtyId")?.trim();

  try {
    await connectDB();

    if (specialtyId === undefined) {
      const specialties = await Specialty.find({})
        .select("_id name")
        .sort({ name: 1 })
        .lean();

      return NextResponse.json(
        {
          success: true,
          data: {
            specialties: specialties.map((specialty) => ({
              id: specialty._id.toString(),
              name: specialty.name,
            })),
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!mongoose.isValidObjectId(specialtyId)) {
      return NextResponse.json(
        { success: false, error: "Specialty is invalid" },
        { status: 400 },
      );
    }

    if (!(await Specialty.exists({ _id: specialtyId }))) {
      return NextResponse.json(
        { success: false, error: "Specialty not found" },
        { status: 404 },
      );
    }

    const doctors = await User.find({
      role: "DOCTOR",
      isActive: true,
      specialtyId,
    })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: {
          doctors: doctors.map((doctor) => ({
            id: doctor._id.toString(),
            name: doctor.name,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load appointment options" },
      { status: 500 },
    );
  }
}
