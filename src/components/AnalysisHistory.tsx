"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Trash2, Eye, FileX } from "lucide-react";
import {
  listAnalyses,
  deleteAnalysis,
  clearAnalyses,
  AnalysisSummary,
} from "@/lib/analysis-store";

interface AnalysisHistoryProps {
  onLoad: (id: string) => void;
  refreshKey?: number;
}

export default function AnalysisHistory({ onLoad, refreshKey }: AnalysisHistoryProps) {
  const [history, setHistory] = useState<AnalysisSummary[]>([]);

  const refresh = useCallback(async () => {
    try {
      setHistory(await listAnalyses());
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleDelete = async (id: string) => {
    await deleteAnalysis(id);
    refresh();
  };

  const handleClearAll = async () => {
    await clearAnalyses();
    refresh();
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
          onClick={handleClearAll}
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
          const applicable = entry.result.checklist.filter(
            (c) => c.status !== "not_applicable"
          ).length;
          const reviewed = entry.result.checklist.filter(
            (c) => c.review?.approved
          ).length;
          const reviewRate =
            applicable > 0 ? Math.round((reviewed / applicable) * 100) : 0;
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
                  <span
                    className={`font-medium ${
                      reviewRate === 100
                        ? "text-emerald-600"
                        : reviewRate > 0
                          ? "text-emerald-500"
                          : "text-gray-400"
                    }`}
                    title="Reviewer approvals"
                  >
                    {reviewed}/{applicable} reviewed
                  </span>
                </div>
              </div>
              {!entry.hasPdf && (
                <span
                  className="flex items-center gap-1 text-[10px] text-gray-400"
                  title="No PDF saved with this entry — attach the file manually"
                >
                  <FileX className="w-3 h-3" />
                  no PDF
                </span>
              )}
              <button
                onClick={() => onLoad(entry.id)}
                className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"
                title="Load this analysis"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
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
