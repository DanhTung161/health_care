import Header from "@/components/client/Header"; // Header tự định nghĩa
import Footer from "@/components/client/Footer"; // Footer tự định nghĩa

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}