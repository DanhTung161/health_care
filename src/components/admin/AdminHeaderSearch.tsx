"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/roles";

type PatientResult = {
  _id: string;
  fullName: string;
  phone: string;
};

type DoctorResult = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialtyId?: { name?: string } | null;
};

type SearchResponse = { success: boolean; data?: unknown; error?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readResponse(value: unknown): SearchResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return { success: false, error: "Unexpected search response" };
  }
  return {
    success: value.success,
    ...(typeof value.error === "string" ? { error: value.error } : {}),
    ...("data" in value ? { data: value.data } : {}),
  };
}

function asPatientResults(value: unknown): PatientResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item._id !== "string" || typeof item.fullName !== "string" || typeof item.phone !== "string") return [];
    return [{ _id: item._id, fullName: item.fullName, phone: item.phone }];
  });
}

function asDoctorResults(value: unknown): DoctorResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item._id !== "string" || typeof item.name !== "string" || typeof item.email !== "string") return [];
    const specialty = isRecord(item.specialtyId) && typeof item.specialtyId.name === "string" ? { name: item.specialtyId.name } : undefined;
    return [{ _id: item._id, name: item.name, email: item.email, ...(typeof item.phone === "string" ? { phone: item.phone } : {}), ...(specialty ? { specialtyId: specialty } : {}) }];
  });
}

async function searchEndpoint(url: string, signal: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(url, { credentials: "same-origin", signal });
  const result = readResponse(await response.json().catch(() => null));
  if (!response.ok || !result.success) throw new Error(result.error ?? "Search is unavailable");
  return result;
}

export default function AdminHeaderSearch({ role }: { role: Role }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [doctors, setDoctors] = useState<DoctorResult[]>([]);
  const [completedQuery, setCompletedQuery] = useState("");
  const normalizedQuery = query.trim();

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (normalizedQuery.length < 2) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");
      setCompletedQuery(normalizedQuery);
      try {
        const encodedQuery = encodeURIComponent(normalizedQuery);
        const patientRequest = searchEndpoint(`/api/patients?search=${encodedQuery}&limit=5&sortBy=fullName&sortOrder=asc&summary=header`, controller.signal);
        const doctorRequest = role === "ADMIN"
          ? searchEndpoint(`/api/doctors?search=${encodedQuery}&limit=5`, controller.signal)
          : Promise.resolve(undefined);
        const [patientResult, doctorResult] = await Promise.all([patientRequest, doctorRequest]);
        if (controller.signal.aborted) return;
        setPatients(asPatientResults(patientResult.data));
        setDoctors(doctorResult ? asDoctorResults(doctorResult.data) : []);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setPatients([]);
        setDoctors([]);
        setError(searchError instanceof Error ? searchError.message : "Search is unavailable");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedQuery, role]);

  const hasResults = patients.length > 0 || doctors.length > 0;
  const isSearching = isLoading || completedQuery !== normalizedQuery;

  return (
    <div ref={containerRef} className="relative hidden w-72 lg:block">
      <div className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-3 text-[12px] text-slate-500 focus-within:ring-2 focus-within:ring-blue-500/30">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); }}
          placeholder={role === "ADMIN" ? "Search patients, doctors..." : "Search patients..."}
          aria-label="Search records"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && normalizedQuery.length >= 2}
          aria-controls="header-search-results"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {query && <button type="button" onClick={() => { setQuery(""); setIsOpen(false); }} aria-label="Clear search" className="rounded p-0.5 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>}
      </div>
      {isOpen && normalizedQuery.length >= 2 && (
        <div id="header-search-results" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
          {isSearching && <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>}
          {!isSearching && error && <p role="alert" className="px-4 py-3 text-sm text-rose-600">{error}</p>}
          {!isSearching && !error && !hasResults && <p className="px-4 py-3 text-sm text-slate-500">No matching records found.</p>}
          {!isSearching && !error && patients.length > 0 && <ResultGroup title="Patients">
            {patients.map((patient) => <Link key={patient._id} href={`/patients/${patient._id}`} onClick={() => setIsOpen(false)} className="block px-4 py-2.5 hover:bg-slate-50"><p className="truncate text-sm font-semibold text-slate-800">{patient.fullName}</p><p className="truncate text-xs text-slate-500">{patient.phone}</p></Link>)}
          </ResultGroup>}
          {!isSearching && !error && doctors.length > 0 && <ResultGroup title="Doctors">
            {doctors.map((doctor) => <Link key={doctor._id} href="/doctors" onClick={() => setIsOpen(false)} className="block px-4 py-2.5 hover:bg-slate-50"><p className="truncate text-sm font-semibold text-slate-800">{doctor.name}</p><p className="truncate text-xs text-slate-500">{doctor.specialtyId?.name ?? doctor.email}{doctor.specialtyId?.name ? ` · ${doctor.email}` : ""}</p></Link>)}
          </ResultGroup>}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="py-1"><h2 className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h2>{children}</section>;
}
