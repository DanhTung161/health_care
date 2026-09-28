import type { ReactNode } from "react";

import Footer from "@/components/client/Footer";
import Header from "@/components/client/Header";

export default function StorefrontShell({
  children,
  footer = <Footer />,
}: {
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="storefront flex min-h-screen flex-col" id="storefront-top">
      <Header />
      <main className="flex-grow">{children}</main>
      {footer}
    </div>
  );
}
