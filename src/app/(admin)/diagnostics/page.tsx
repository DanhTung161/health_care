import DiagnosticOrdersList, {
  type DiagnosticOrderFilters,
} from "@/components/admin/DiagnosticOrdersList";
import {
  isDiagnosticStatus,
  isDiagnosticType,
} from "@/lib/diagnostic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const type = first(params.type);
  const status = first(params.status);
  const pageValue = Number(first(params.page) || "1");
  const initialFilters: DiagnosticOrderFilters = {
    patientId: first(params.patientId),
    type: isDiagnosticType(type) ? type : "",
    status: isDiagnosticStatus(status) ? status : "",
    from: first(params.from),
    to: first(params.to),
  };
  const initialPage =
    Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;

  return (
    <DiagnosticOrdersList
      initialFilters={initialFilters}
      initialPage={initialPage}
    />
  );
}
