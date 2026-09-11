"use client";

import Image from "next/image";
import { Printer, X } from "lucide-react";

export interface InternalInvoicePreviewData {
  invoiceNo: string;
  lookupCode: string;
  invoiceDate: string;
  patient: { fullName: string; phone: string | null } | null;
  appointment: {
    appointmentDate: string;
    timeSlot: string;
    doctorName: string | null;
  } | null;
  lineItems: Array<{
    id: string;
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  insurance: {
    grossSubtotal: number;
    effectiveInsurancePaid: number;
    postInsuranceAmount: number;
  };
  totals: {
    vatAmount: number;
    totalPatientPayable: number;
    paymentStatus: string;
  };
}

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function InternalInvoicePreview({
  invoice,
  onClose,
}: {
  invoice: InternalInvoicePreviewData;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Xem hóa đơn nội bộ"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden !important; }
          #internal-invoice-preview,
          #internal-invoice-preview * { visibility: visible !important; }
          #internal-invoice-preview {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .internal-invoice-screen-controls { display: none !important; }
        }
      `}</style>
      <article
        id="internal-invoice-preview"
        className="mx-auto my-4 max-w-4xl rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-10"
      >
        <div className="internal-invoice-screen-controls mb-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Đóng xem hóa đơn</span>
          </button>
        </div>
        <div className="border-b-2 border-slate-900 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <Image
              src="/brand/bigmedix-logo.svg"
              alt="BigMedix"
              width={220}
              height={56}
              unoptimized
              className="h-auto w-44"
            />
            <div className="text-right text-sm text-slate-600">
              <p>Mã hóa đơn: <strong className="text-slate-900">{invoice.invoiceNo}</strong></p>
              <p className="mt-1">Mã tra cứu: <strong className="text-slate-900">{invoice.lookupCode}</strong></p>
              <p className="mt-1">Ngày lập: {date(invoice.invoiceDate)}</p>
            </div>
          </div>
          <div className="mt-5 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-center text-sm font-bold leading-6 text-amber-900">
            HÓA ĐƠN NỘI BỘ / BẢN MÔ PHỎNG - KHÔNG CÓ GIÁ TRỊ HÓA ĐƠN ĐIỆN TỬ
          </div>
        </div>

        <div className="grid gap-5 py-6 text-sm sm:grid-cols-2">
          <section>
            <h2 className="font-bold uppercase tracking-wide text-slate-900">Thông tin bệnh nhân</h2>
            <p className="mt-2 font-semibold">{invoice.patient?.fullName ?? "Không xác định"}</p>
            <p className="mt-1 text-slate-600">Điện thoại: {invoice.patient?.phone ?? "—"}</p>
          </section>
          <section>
            <h2 className="font-bold uppercase tracking-wide text-slate-900">Thông tin lịch hẹn</h2>
            {invoice.appointment ? <><p className="mt-2">{date(invoice.appointment.appointmentDate)} · {invoice.appointment.timeSlot}</p><p className="mt-1 text-slate-600">Bác sĩ: {invoice.appointment.doctorName ?? "Không xác định"}</p></> : <p className="mt-2 text-slate-600">Không có lịch hẹn liên kết.</p>}
          </section>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 text-xs uppercase text-slate-600"><th className="px-2 py-3">Dịch vụ</th><th className="px-2 py-3 text-right">SL</th><th className="px-2 py-3 text-right">Đơn giá</th><th className="px-2 py-3 text-right">Thành tiền</th></tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => <tr key={item.id} className="border-b border-slate-200"><td className="px-2 py-3"><p className="font-medium">{item.description}</p><p className="text-xs text-slate-500">{item.category}</p></td><td className="px-2 py-3 text-right">{item.quantity}</td><td className="px-2 py-3 text-right">{money(item.unitPrice)}</td><td className="px-2 py-3 text-right font-medium">{money(item.amount)}</td></tr>)}
          </tbody>
        </table>

        <div className="ml-auto mt-6 max-w-sm text-sm">
          <div className="flex justify-between gap-5 py-2"><span>Gross subtotal</span><strong>{money(invoice.insurance.grossSubtotal)}</strong></div>
          <div className="flex justify-between gap-5 py-2"><span>Insurance payment</span><strong>{money(invoice.insurance.effectiveInsurancePaid)}</strong></div>
          <div className="flex justify-between gap-5 py-2"><span>Post-insurance amount</span><strong>{money(invoice.insurance.postInsuranceAmount)}</strong></div>
          <div className="flex justify-between gap-5 py-2"><span>VAT 8%</span><strong>{money(invoice.totals.vatAmount)}</strong></div>
          <div className="flex justify-between gap-5 border-t-2 border-slate-900 py-3 text-base"><span className="font-bold">Patient payable</span><strong>{money(invoice.totals.totalPatientPayable)}</strong></div>
          <div className="flex justify-between gap-5 py-1"><span>Payment status</span><strong>{invoice.totals.paymentStatus.replaceAll("_", " ")}</strong></div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          Tài liệu nội bộ BigMedix dùng để xem và in thông tin thanh toán. Không phải hóa đơn điện tử được phát hành theo quy định của cơ quan thuế.
        </div>
        <div className="internal-invoice-screen-controls mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Đóng</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Printer className="h-4 w-4" /> In / Lưu PDF</button>
        </div>
      </article>
    </div>
  );
}
