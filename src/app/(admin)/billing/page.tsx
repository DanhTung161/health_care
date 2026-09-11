import BillingManagement from "@/components/admin/BillingManagement";
import { getCurrentUser } from "@/lib/auth";
import { roleLandingPage } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    redirect(`${roleLandingPage[user.role]}?error=unauthorized`);
  }

  return <BillingManagement role={user.role} />;
}
