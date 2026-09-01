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

function getDownloadFilename(
  response: Response,
  fallback: string,
): string {
  const disposition = response.headers.get("content-disposition");
  const encodedMatch = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }
  const quotedMatch = disposition?.match(/filename="([^"]+)"/i);
  return quotedMatch?.[1] ?? fallback;
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
  const printWindow =
    format === "print" ? window.open("", "_blank") : null;
  if (format === "print" && !printWindow) {
    throw new Error("Allow pop-ups to open the print-ready history export.");
  }
  if (printWindow) {
    printWindow.document.write(
      "<!doctype html><title>Preparing evidence report</title><p style=\"font:16px Arial;padding:24px\">Preparing location evidence report…</p>",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${path}?${params.toString()}`, {
      credentials: "include",
      headers: { Accept: format === "json" ? "application/json" : "*/*" },
    });
  } catch (error) {
    printWindow?.close();
    throw error;
  }
  if (!response.ok) {
    printWindow?.close();
    throw new Error("Location history export request failed.");
  }

  if (format === "print") {
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(await response.text());
    printWindow.document.close();
    printWindow.focus();
    return;
  }

  const scope = endpointId ? endpointId : "fleet";
  const dateStamp = new Date().toISOString().replaceAll(":", "-");
  downloadBlob(
    await response.blob(),
    getDownloadFilename(
      response,
      `les-location-evidence-${scope}-${dateStamp}.${format === "json" ? "json" : "csv"}`,
    ),
  );
}