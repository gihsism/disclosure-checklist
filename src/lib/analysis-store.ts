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
