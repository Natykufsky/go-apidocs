import type { QARecord } from "../components/QAReportModal";

/** Build a CSV string from QA records and trigger a browser download. */
export function exportQACsv(
  endpoints: string[],
  qaData: Record<string, QARecord>,
  filename = `qa-report-${new Date().toISOString().slice(0, 10)}.csv`,
): void {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: string[][] = [
    ["Endpoint", "Status", "Comment", "Tested At"],
    ...endpoints.map((ep) => {
      const r = qaData[ep];
      return [
        ep,
        r?.status || "untested",
        r?.comment || "",
        r?.tested_at || "",
      ];
    }),
  ];
  const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
