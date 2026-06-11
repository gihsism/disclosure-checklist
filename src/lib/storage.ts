/**
 * Unified storage: dispatches to IndexedDB (anonymous) or the server API
 * (authenticated) based on session presence.
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
import {
  saveAnalysisRemote,
  listAnalysesRemote,
  loadAnalysisRemote,
  updateAnalysisResultRemote,
  deleteAnalysisRemote,
} from "./remote-store";

export interface Storage {
  save(entry: { fileName: string; result: AnalysisResult; file?: File }): Promise<string>;
  list(): Promise<AnalysisSummary[]>;
  load(id: string): Promise<AnalysisRecord | null>;
  update(id: string, result: AnalysisResult): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

const localStorage: Storage = {
  save: (e) => saveLocal(e),
  list: () => listLocal(),
  load: (id) => loadLocal(id),
  update: (id, r) => updateLocal(id, r),
  delete: (id) => deleteLocal(id),
  clear: () => clearLocal(),
};

const remoteStorage: Storage = {
  save: (e) => saveAnalysisRemote(e),
  list: () => listAnalysesRemote(),
  load: (id) => loadAnalysisRemote(id),
  update: (id, r) => updateAnalysisResultRemote(id, r),
  delete: (id) => deleteAnalysisRemote(id),
  clear: async () => {
    const entries = await listAnalysesRemote();
    await Promise.all(entries.map((e) => deleteAnalysisRemote(e.id)));
  },
};

export function getStorage(isAuthenticated: boolean): Storage {
  return isAuthenticated ? remoteStorage : localStorage;
}
