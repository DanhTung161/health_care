import { Badge, Card, PageIntro } from "@/components/admin/AdminUI";
import {
  CreateDoctorForm,
  DoctorActions,
  type DoctorAccount,
  type SpecialtyOption,
} from "@/components/admin/DoctorManagementForms";
import connectDB from "@/lib/db";
import Specialty from "@/models/Specialty";
import User, { IUser } from "@/models/User";

type DoctorListItem = DoctorAccount & Pick<IUser, "role">;

async function getDoctors(): Promise<DoctorListItem[]> {
  await connectDB();
  const doctors = await User.find({ role: "DOCTOR" })
    .populate("specialtyId", "name")
    .select("name email phone role specialtyId isActive")
    .sort({ name: 1 })
    .lean();

  return JSON.parse(JSON.stringify(doctors)) as DoctorListItem[];
}

async function getSpecialties(): Promise<SpecialtyOption[]> {
  await connectDB();
  const specialties = await Specialty.find({}).select("name").sort({ name: 1 }).lean();

  return JSON.parse(JSON.stringify(specialties)) as SpecialtyOption[];
}

export default async function Doctors() {
  const [doctors, specialties] = await Promise.all([getDoctors(), getSpecialties()]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro title="Medical team" actionSlot={<CreateDoctorForm specialties={specialties} />} />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {doctors?.map((doctor) => (
          <Card key={doctor._id}>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {doctor.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <h3 className="font-bold text-slate-800">{doctor.name}</h3>
                <p className="text-xs text-slate-500">
                  {doctor.specialtyId?.name ?? "Unassigned"}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <span className="truncate text-xs text-slate-500">
                {doctor.email}
              </span>
              <Badge tone={doctor.isActive ? "green" : "amber"}>
                {doctor.isActive ? "Available" : "Unavailable"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <h3 className="mb-4 font-bold">Doctors directory</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Doctor</th>
                <th className="pb-3 font-medium">Doctor ID</th>
                <th className="pb-3 font-medium">Specialty</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Availability</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors?.map((doctor) => (
                <tr
                  key={doctor._id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-4 font-semibold text-slate-800">
                    {doctor.name}
                  </td>
                  <td className="py-4 text-slate-500">{doctor._id}</td>
                  <td className="py-4 text-slate-500">
                    {doctor.specialtyId?.name ?? "Unassigned"}
                  </td>
                  <td className="py-4 text-slate-500">{doctor.email}</td>
                  <td className="py-4">
                    <Badge tone={doctor.isActive ? "green" : "amber"}>
                      {doctor.isActive ? "Available" : "Unavailable"}
                    </Badge>
                  </td>
                  <td className="py-4">
                    <DoctorActions doctor={doctor} specialties={specialties} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mt-5">
        <h3 className="mb-4 font-bold">Department capacity</h3>
        <div className="space-y-5">
          {[
            ["Cardiology", "85%", "bg-blue-500"],
            ["Neurology", "72%", "bg-emerald-500"],
            ["Dermatology", "64%", "bg-amber-500"],
            ["Orthopedics", "91%", "bg-violet-500"],
          ].map(([label, value, color]) => (
            <div key={label}>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="text-slate-500">{value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${color}`}
                  style={{ width: value }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
