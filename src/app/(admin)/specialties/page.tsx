import { Card, PageIntro } from "@/components/admin/AdminUI";
import {
  CreateSpecialtyForm,
  SpecialtyActions,
  type SpecialtyItem,
} from "@/components/admin/SpecialtyManagement";
import connectDB from "@/lib/db";
import Specialty from "@/models/Specialty";

async function getSpecialties(): Promise<SpecialtyItem[]> {
  await connectDB();
  const specialties = await Specialty.find({})
    .select("name description")
    .sort({ name: 1 })
    .lean();

  return JSON.parse(JSON.stringify(specialties)) as SpecialtyItem[];
}

export default async function SpecialtiesPage() {
  const specialties = await getSpecialties();

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro title="Specialty management" actionSlot={<CreateSpecialtyForm />} />
      <Card>
        <div className="mb-5">
          <h3 className="font-bold text-slate-900">Clinical specialties</h3>
          <p className="mt-1 text-xs text-slate-400">
            Manage specialties that can be assigned to doctors.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Specialty</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {specialties.map((specialty) => (
                <tr key={specialty._id} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 font-semibold text-slate-800">{specialty.name}</td>
                  <td className="max-w-xl py-4 text-slate-500">{specialty.description || "—"}</td>
                  <td className="py-4"><SpecialtyActions specialty={specialty} /></td>
                </tr>
              ))}
              {!specialties.length && (
                <tr><td colSpan={3} className="py-8 text-center text-sm text-slate-500">No specialties have been created yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
