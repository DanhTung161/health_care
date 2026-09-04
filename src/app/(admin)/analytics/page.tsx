import { Card, PageIntro } from "@/components/admin/AdminUI";
export default function Analytics() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro title="Performance analytics" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Total revenue</p>
          <p className="mt-2 text-2xl font-bold">$328,450</p>
          <p className="mt-2 text-xs font-semibold text-emerald-600">
            ↑ 12.5% from last month
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Patient satisfaction</p>
          <p className="mt-2 text-2xl font-bold">4.8 / 5</p>
          <p className="mt-2 text-xs font-semibold text-emerald-600">
            ↑ 0.3 points
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Average wait time</p>
          <p className="mt-2 text-2xl font-bold">18 min</p>
          <p className="mt-2 text-xs font-semibold text-emerald-600">
            ↓ 12% improvement
          </p>
        </Card>
      </div>
      <Card className="mt-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">Revenue performance</h3>
            <p className="mt-1 text-xs text-slate-400">
              Monthly revenue across all departments
            </p>
          </div>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
            <option>2026</option>
          </select>
        </div>
        <div className="mt-8 flex h-64 items-end gap-3 border-b border-l border-slate-100 px-5">
          {[48, 58, 52, 70, 62, 76, 68, 82, 74, 90, 80, 96].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-blue-500"
                style={{ height: `${h}%` }}
              />
              <span className="text-[11px] text-slate-400">
                {
                  [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                  ][i]
                }
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
