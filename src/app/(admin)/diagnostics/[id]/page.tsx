import { redirect } from "next/navigation";
import DiagnosticOrderDetailView from "@/components/admin/DiagnosticOrderDetail";
import { getCurrentUser } from "@/lib/auth";

export default async function DiagnosticOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) redirect("/login");

  return (
    <DiagnosticOrderDetailView
      orderId={id}
      currentUser={{ id: user.id, role: user.role }}
    />
  );
}
