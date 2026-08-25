export type RecoveryHistoryExportFormat = "json" | "csv" | "print";

interface RecoveryHistoryExportOptions {
  endpointId?: string;
  endpointIds?: Iterable<string>;
  from?: string;
  to?: string;
  format: RecoveryHistoryExportFormat;
}

function appendDateRange(params: URLSearchParams, from?: string, to?: string): void {
  if (from) {
    params.set("from", new Date(`${from}T00:00:00.000Z`).toISOString());
  }
  if (to) {
    params.set("to", new Date(`${to}T23:59:59.999Z`).toISOString());
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportRecoveryLocationHistory({
  endpointId,
  endpointIds,
  from,
  to,
  format,
}: RecoveryHistoryExportOptions): Promise<void> {
  const params = new URLSearchParams({ format });
  appendDateRange(params, from, to);
  const path = endpointId
    ? `/api/recovery/devices/${encodeURIComponent(endpointId)}/location-history/export`
    : "/api/recovery/location-history/export";
  if (!endpointId) {
    for (const candidate of endpointIds ?? []) {
      const normalized = candidate.trim();
      if (normalized) {
        params.append("endpointIds", normalized);
      }
    }
  }
  const response = await fetch(`${path}?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: format === "json" ? "application/json" : "*/*" },
  });
  if (!response.ok) {
    throw new Error("Location history export request failed.");
  }

  if (format === "print") {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      throw new Error("Allow pop-ups to open the print-ready history export.");
    }
    printWindow.document.open();
    printWindow.document.write(await response.text());
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
    return;
  }

  const scope = endpointId ? endpointId : "fleet";
  downloadBlob(
    await response.blob(),
    `les-location-history-${scope}.${format === "json" ? "json" : "csv"}`,
  );
}