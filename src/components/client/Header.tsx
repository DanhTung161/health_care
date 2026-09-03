export default function Header() {
  return (
    <header className="border-b bg-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="text-xl font-bold text-emerald-600">HealthCare Client</div>
        <nav className="flex gap-4 text-sm font-medium">
          <a href="/home" className="hover:text-emerald-600">Home</a>
          <a href="/services" className="hover:text-emerald-600">Services</a>
          <a href="/doctors" className="hover:text-emerald-600">Doctors</a>
        </nav>
      </div>
    </header>
  );
}