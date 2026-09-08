import AdminSidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/Header";
import { AdminSidebarProvider } from "@/context/AdminSidebarContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSidebarProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <AdminHeader />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AdminSidebarProvider>
  );
}
