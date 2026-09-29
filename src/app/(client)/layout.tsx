import StorefrontFooter from "@/components/client/StorefrontFooter";
import StorefrontShell from "@/components/client/StorefrontShell";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StorefrontShell footer={<StorefrontFooter />}>
      {children}
    </StorefrontShell>
  );
}
