import { Card, PageIntro } from "@/components/admin/AdminUI";
export default function Settings() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageIntro title="Workspace settings" />
      <Card>
        <h3 className="font-bold">Profile information</h3>
        <p className="mt-1 text-sm text-slate-500">
          Update the details associated with your administrator account.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            First name
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-blue-500"
              defaultValue="Sarah"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Last name
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-blue-500"
              defaultValue="Johnson"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Email address
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-blue-500"
              defaultValue="sarah.johnson@healthnexus.com"
            />
          </label>
        </div>
        <button className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
          Save changes
        </button>
      </Card>
      <Card className="mt-5">
        <h3 className="font-bold">Notifications</h3>
        <div className="mt-5 space-y-4">
          {[
            "Appointment reminders",
            "Payment notifications",
            "Weekly performance report",
          ].map((x) => (
            <label
              key={x}
              className="flex items-center justify-between text-sm text-slate-700"
            >
              {x}
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
