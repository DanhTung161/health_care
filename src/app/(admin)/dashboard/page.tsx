import { Badge, Card, PageIntro, patients } from "@/components/admin/AdminUI";

const stats = [
  ["Total patients", "2,840", "+12.5%", "blue"],
  ["Appointments", "186", "+8.2%", "green"],
  ["Revenue this month", "$48,250", "+5.2%", "amber"],
  ["Pending reviews", "24", "-3.4%", "red"],
] as const;
export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro title="Overview" action="New appointment" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, change, tone]) => (
          <Card key={label}>
            <div className="flex items-start justify-between">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}`}
              >
                ◈
              </span>
              <Badge tone={tone === "red" ? "red" : tone}>{change}</Badge>
            </div>
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Patient inflow trends
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Weekly comparison of new vs returning patients
              </p>
            </div>
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>
          <div className="flex h-56 items-end gap-3 border-b border-l border-slate-100 px-4 pb-0 pt-4">
            {[45, 62, 53, 78, 66, 92, 70, 82, 58, 88, 72, 96, 65, 45].map(
              (height, i) => (
                <div key={i} className="group flex h-full flex-1 items-end">
                  <div
                    style={{ height: `${height}%` }}
                    className={`w-full rounded-t-md transition group-hover:opacity-70 ${i % 3 === 0 ? "bg-blue-400" : "bg-emerald-400"}`}
                  />
                </div>
              ),
            )}
          </div>
          <div className="mt-3 flex justify-between px-1 text-[11px] text-slate-400">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
        </Card>
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Today’s appointments</h3>
              <p className="mt-1 text-xs text-slate-400">
                Wednesday, September 4, 2026
              </p>
            </div>
            <a
              href="/appointments"
              className="text-xs font-semibold text-blue-600"
            >
              View all
            </a>
          </div>
          <div className="space-y-4">
            {[
              [
                "09:00",
                "Olivia Martin",
                "Dr. Emily Carter",
                "bg-violet-100 text-violet-700",
              ],
              [
                "10:30",
                "Liam Anderson",
                "Dr. Michael Chen",
                "bg-blue-100 text-blue-700",
              ],
              [
                "13:00",
                "Emma Thompson",
                "Dr. Sarah Lee",
                "bg-amber-100 text-amber-700",
              ],
              [
                "15:30",
                "Noah Williams",
                "Dr. Emily Carter",
                "bg-emerald-100 text-emerald-700",
              ],
            ].map(([time, name, doctor, color]) => (
              <div key={time} className="flex items-center gap-3">
                <span className="w-11 text-xs font-semibold text-slate-400">
                  {time}
                </span>
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${color}`}
                >
                  {name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {name}
                  </p>
                  <p className="truncate text-xs text-slate-400">{doctor}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Recent patients</h3>
          <a href="/patients" className="text-xs font-semibold text-blue-600">
            View all patients →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Patient</th>
                <th className="pb-3 font-medium">Patient ID</th>
                <th className="pb-3 font-medium">Age</th>
                <th className="pb-3 font-medium">Last visit</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-4 font-semibold text-slate-800">
                    {p.name}
                  </td>
                  <td className="py-4 text-slate-500">{p.id}</td>
                  <td className="py-4 text-slate-500">{p.age}</td>
                  <td className="py-4 text-slate-500">Sep 03, 2026</td>
                  <td className="py-4">
                    <Badge tone={p.status === "Active" ? "green" : "amber"}>
                      {p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
