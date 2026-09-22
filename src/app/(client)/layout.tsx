import StorefrontShell from "@/components/client/StorefrontShell";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
