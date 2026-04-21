/**
 * Single IndexedDB store for full analyses: result + PDF together.
 * One record per analysis, so loading from history hydrates everything at once.
 */

import { AnalysisResult } from "@/types";

const DB_NAME = "disclosure-checklist";
const STORE_NAME = "analyses";
const DB_VERSION = 1;
const MAX_ENTRIES = 20;

export interface AnalysisRecord {
  id: string;
  fileName: string;
  savedAt: string;
  result: AnalysisResult;
  pdf?: {
    data: ArrayBuffer;
    name: string;
    type: string;
  };
}

export interface AnalysisSummary {
  id: string;
  fileName: string;
  savedAt: string;
  hasPdf: boolean;
  result: AnalysisResult;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAnalysis(entry: {
  fileName: string;
  result: AnalysisResult;
  file?: File;
}): Promise<string> {
  const db = await openDB();
  const id = `a-${Date.now()}`;
  const record: AnalysisRecord = {
    id,
    fileName: entry.fileName,
    savedAt: new Date().toISOString(),
    result: entry.result,
  };
  if (entry.file) {
    record.pdf = {
      data: await entry.file.arrayBuffer(),
      name: entry.file.name,
      type: entry.file.type,
    };
  }

  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Retention: keep newest MAX_ENTRIES
  const all = await listAnalyses();
  if (all.length > MAX_ENTRIES) {
    const toDelete = all.slice(MAX_ENTRIES);
    for (const e of toDelete) await deleteAnalysis(e.id);
  }
  return id;
}

export async function updateAnalysisResult(
  id: string,
  result: AnalysisResult
): Promise<void> {
  const db = await openDB();
  const existing = await loadAnalysis(id);
  if (!existing) return;
  const updated: AnalysisRecord = { ...existing, result };
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(updated);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listAnalyses(): Promise<AnalysisSummary[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const records = await new Promise<AnalysisRecord[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as AnalysisRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
  return records
    .map((r) => ({
      id: r.id,
      fileName: r.fileName,
      savedAt: r.savedAt,
      hasPdf: !!r.pdf,
      result: r.result,
    }))
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function loadAnalysis(id: string): Promise<AnalysisRecord | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as AnalysisRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAnalyses(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function pdfRecordToFile(pdf: NonNullable<AnalysisRecord["pdf"]>): File {
  return new File([pdf.data], pdf.name, { type: pdf.type });
}

const MANIFEST_NAME = "manifest.json";

export async function exportAllAsZip(): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const records = await new Promise<AnalysisRecord[]>((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as AnalysisRecord[]) || []);
    req.onerror = () => reject(req.error);
  });

  const zip = new JSZip();
  const manifest: Array<{
    id: string;
    fileName: string;
    savedAt: string;
    folder: string;
    pdfFile?: string;
  }> = [];

  for (const r of records) {
    const safeId = r.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const folderName = `${r.savedAt.slice(0, 10)}_${safeId}`;
    const folder = zip.folder(folderName);
    if (!folder) continue;
    folder.file("result.json", JSON.stringify(r.result, null, 2));
    folder.file(
      "meta.json",
      JSON.stringify(
        {
          id: r.id,
          fileName: r.fileName,
          savedAt: r.savedAt,
          pdf: r.pdf
            ? { name: r.pdf.name, type: r.pdf.type, size: r.pdf.data.byteLength }
            : null,
        },
        null,
        2
      )
    );
    let pdfFile: string | undefined;
    if (r.pdf) {
      pdfFile = r.pdf.name || "document.pdf";
      folder.file(pdfFile, r.pdf.data);
    }
    manifest.push({
      id: r.id,
      fileName: r.fileName,
      savedAt: r.savedAt,
      folder: folderName,
      pdfFile,
    });
  }

  zip.file(
    MANIFEST_NAME,
    JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), entries: manifest },
      null,
      2
    )
  );

  return zip.generateAsync({ type: "blob" });
}

export async function importFromZip(file: File): Promise<{
  imported: number;
  skipped: number;
}> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file(MANIFEST_NAME);
  if (!manifestFile) {
    throw new Error(`Zip missing ${MANIFEST_NAME} — not a history export`);
  }
  const manifest = JSON.parse(await manifestFile.async("string")) as {
    version: number;
    entries: Array<{
      id: string;
      fileName: string;
      savedAt: string;
      folder: string;
      pdfFile?: string;
    }>;
  };

  const existing = new Set((await listAnalyses()).map((a) => a.id));
  const db = await openDB();
  let imported = 0;
  let skipped = 0;

  for (const entry of manifest.entries) {
    if (existing.has(entry.id)) {
      skipped++;
      continue;
    }
    const resultFile = zip.file(`${entry.folder}/result.json`);
    if (!resultFile) {
      skipped++;
      continue;
    }
    const result = JSON.parse(await resultFile.async("string")) as AnalysisResult;
    const record: AnalysisRecord = {
      id: entry.id,
      fileName: entry.fileName,
      savedAt: entry.savedAt,
      result,
    };
    if (entry.pdfFile) {
      const pdfEntry = zip.file(`${entry.folder}/${entry.pdfFile}`);
      if (pdfEntry) {
        const data = await pdfEntry.async("arraybuffer");
        record.pdf = {
          data,
          name: entry.pdfFile,
          type: "application/pdf",
        };
      }
    }

    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    imported++;
  }

  return { imported, skipped };
}
