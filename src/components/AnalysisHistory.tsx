"use client";

import { useState, useEffect } from "react";
import { AnalysisResult } from "@/types";
import { Clock, Trash2, Eye } from "lucide-react";

interface SavedAnalysis {
  id: string;
  fileName: string;
  pdfId: string; // links to IndexedDB PDF store
  savedAt: string;
  result: AnalysisResult;
}

interface AnalysisHistoryProps {
  onLoad: (result: AnalysisResult, pdfId: string) => void;
}

export function saveToHistory(fileName: string, result: AnalysisResult, pdfId: string) {
  try {
    const history: SavedAnalysis[] = JSON.parse(
      localStorage.getItem("disclosure-checklist-history") || "[]"
    );
    const entry: SavedAnalysis = {
      id: Date.now().toString(),
      fileName,
      pdfId,
      savedAt: new Date().toISOString(),
      result,
    };
    // Keep last 20
    history.unshift(entry);
    if (history.length > 20) history.pop();
    localStorage.setItem(
      "disclosure-checklist-history",
      JSON.stringify(history)
    );
  } catch {
    /* localStorage full or unavailable */
  }
}

export default function AnalysisHistory({ onLoad }: AnalysisHistoryProps) {
  const [history, setHistory] = useState<SavedAnalysis[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("disclosure-checklist-history") || "[]"
      );
      setHistory(saved);
    } catch {
      setHistory([]);
    }
  }, []);

  const deleteEntry = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem(
      "disclosure-checklist-history",
      JSON.stringify(updated)
    );
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem("disclosure-checklist-history");
  };

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Analysis History
        </h3>
        <button
          onClick={clearAll}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Clear All
        </button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {history.map((entry) => {
          const s = entry.result.summary;
          const rate =
            s.total > 0
              ? Math.round(((s.present + s.notApplicable) / s.total) * 100)
              : 0;
          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {entry.fileName || "Analysis"}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>
                    {new Date(entry.savedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>{s.total} items</span>
                  <span
                    className={`font-medium ${
                      rate >= 80
                        ? "text-green-600"
                        : rate >= 50
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {rate}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => onLoad(entry.result, entry.pdfId || entry.id)}
                className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"
                title="Load this analysis"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteEntry(entry.id)}
                className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
