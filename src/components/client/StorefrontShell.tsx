import type { ReactNode } from "react";

import Footer from "@/components/client/Footer";
import Header from "@/components/client/Header";

export default function StorefrontShell({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="storefront flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
