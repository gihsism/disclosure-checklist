/**
 * Server-backed analysis storage (authenticated users).
 * Same shape as analysis-store so callers can swap on session state.
 */

import type { AnalysisResult } from "@/types";
import type { AnalysisRecord, AnalysisSummary } from "./analysis-store";

export async function saveAnalysisRemote(entry: {
  fileName: string;
  result: AnalysisResult;
  file?: File;
}): Promise<string> {
  const form = new FormData();
  form.set("fileName", entry.fileName);
  form.set("result", JSON.stringify(entry.result));
  if (entry.file) form.set("pdf", entry.file);

  const res = await fetch("/api/analyses", { method: "POST", body: form });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function listAnalysesRemote(): Promise<AnalysisSummary[]> {
  const res = await fetch("/api/analyses");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const data = (await res.json()) as {
    entries: Array<{
      id: string;
      fileName: string;
      savedAt: string;
      result: AnalysisResult;
      hasPdf: boolean;
    }>;
  };
  return data.entries;
}

export async function loadAnalysisRemote(id: string): Promise<AnalysisRecord | null> {
  const res = await fetch(`/api/analyses/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  const data = (await res.json()) as {
    id: string;
    fileName: string;
    savedAt: string;
    result: AnalysisResult;
    pdf: { url: string; name: string; type: string; size: number } | null;
  };
  const record: AnalysisRecord = {
    id: data.id,
    fileName: data.fileName,
    savedAt: data.savedAt,
    result: data.result,
  };
  if (data.pdf) {
    const blobRes = await fetch(data.pdf.url);
    if (blobRes.ok) {
      record.pdf = {
        data: await blobRes.arrayBuffer(),
        name: data.pdf.name,
        type: data.pdf.type,
      };
    }
  }
  return record;
}

export async function updateAnalysisResultRemote(
  id: string,
  result: AnalysisResult
): Promise<void> {
  const res = await fetch(`/api/analyses/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ result }),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status}`);
}

export async function deleteAnalysisRemote(id: string): Promise<void> {
  const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete failed: ${res.status}`);
  }
}
