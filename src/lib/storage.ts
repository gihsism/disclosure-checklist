/**
 * History storage. Analyses are kept locally in the browser (IndexedDB)
 * regardless of sign-in, so signing in never hides or loses previously saved
 * analyses. Sign-in is identity-only; it does not move history to a server.
 */

import type { AnalysisResult } from "@/types";
import {
  saveAnalysis as saveLocal,
  listAnalyses as listLocal,
  loadAnalysis as loadLocal,
  updateAnalysisResult as updateLocal,
  deleteAnalysis as deleteLocal,
  clearAnalyses as clearLocal,
  AnalysisRecord,
  AnalysisSummary,
} from "./analysis-store";

export interface Storage {
  save(entry: { fileName: string; result: AnalysisResult; file?: File }): Promise<string>;
  list(): Promise<AnalysisSummary[]>;
  load(id: string): Promise<AnalysisRecord | null>;
  update(id: string, result: AnalysisResult): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

const localStorageBackend: Storage = {
  save: (e) => saveLocal(e),
  list: () => listLocal(),
  load: (id) => loadLocal(id),
  update: (id, r) => updateLocal(id, r),
  delete: (id) => deleteLocal(id),
  clear: () => clearLocal(),
};

// Kept for API compatibility with callers; history is always local now.
export function getStorage(_isAuthenticated: boolean): Storage {
  void _isAuthenticated;
  return localStorageBackend;
}
