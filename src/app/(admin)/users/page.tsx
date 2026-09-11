import { Badge, Card, PageIntro } from "@/components/admin/AdminUI";
import CreateUserForm from "@/components/admin/CreateUserForm";
import UserAccountActions from "@/components/admin/UserAccountActions";
import { getCurrentUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import { isRole, roleLandingPage, type Role } from "@/lib/roles";
import User, { IUser } from "@/models/User";
import { redirect } from "next/navigation";

type UserListItem = Pick<
  IUser,
  "name" | "email" | "role" | "phone" | "isActive"
> & {
  _id: string;
};

const roleTone = {
  ADMIN: "red",
  DOCTOR: "blue",
  STAFF: "green",
} as const;

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

async function getUsers(role?: Role): Promise<UserListItem[]> {
  await connectDB();
  const users = await User.find(role ? { role } : {})
    .select("-password")
    .sort({ createdAt: -1 })
    .lean();

  return JSON.parse(JSON.stringify(users)) as UserListItem[];
}

export default async function Users({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, currentUser] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const requestedRole = first(params.role).trim();
  const role = isRole(requestedRole) ? requestedRole : undefined;

  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "ADMIN") {
    redirect(`${roleLandingPage[currentUser.role]}?error=unauthorized`);
  }

  const users = await getUsers(role);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro title="User management" actionSlot={<CreateUserForm />} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Total accounts</p>
          <p className="mt-2 text-2xl font-bold">{users.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Active users</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {users.filter((user) => user.isActive).length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Available roles</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">3</p>
        </Card>
      </div>
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">
              Accounts and permissions
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Assign the right access level to every team member.
            </p>
          </div>
          <form action="/users" className="flex items-center gap-2">
            <label className="sr-only" htmlFor="user-role-filter">
              Filter users by role
            </label>
            <select
              id="user-role-filter"
              name="role"
              defaultValue={role ?? ""}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">All roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="DOCTOR">DOCTOR</option>
              <option value="STAFF">STAFF</option>
            </select>
            <button className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Apply
            </button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">User ID</th>
                <th className="pb-3 font-medium">Role / permission</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Phone</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr
                  key={user._id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="flex items-center gap-3 py-4">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {user.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {user.name}
                      </p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-4 text-slate-500">{user._id}</td>
                  <td className="py-4">
                    <Badge tone={roleTone[user.role]}>{user.role}</Badge>
                  </td>
                  <td className="py-4">
                    <Badge tone={user.isActive ? "green" : "amber"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="py-4 text-slate-500">{user.phone ?? "—"}</td>
                  <td className="py-4">
                    <UserAccountActions
                      user={user}
                      isCurrentUser={user._id === currentUser.id}
                    />
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
