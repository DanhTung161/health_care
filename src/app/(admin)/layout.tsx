import AdminSidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/Header";
import { AdminSidebarProvider } from "@/context/AdminSidebarContext";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AdminSidebarProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <AdminSidebar role={user.role} />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <AdminHeader user={user} />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AdminSidebarProvider>
  );
}
