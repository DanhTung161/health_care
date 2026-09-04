import AdminSidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/Header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <AdminSidebar />
      
      <div className="flex flex-1 flex-col overflow-y-auto">
        <AdminHeader />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}