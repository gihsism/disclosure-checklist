"use client";

import { useState } from "react";
import { ChecklistItem, AnalysisResult } from "@/types";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
} from "lucide-react";

interface AnalysisResultsProps {
  result: AnalysisResult;
  onUpdateItem: (id: string, updates: Partial<ChecklistItem>) => void;
}

const statusConfig = {
  present: {
    icon: CheckCircle,
    label: "Present",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  missing: {
    icon: XCircle,
    label: "Missing",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  partial: {
    icon: AlertTriangle,
    label: "Partial",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  not_applicable: {
    icon: MinusCircle,
    label: "N/A",
    color: "text-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-200",
  },
  unchecked: {
    icon: MinusCircle,
    label: "Unchecked",
    color: "text-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-200",
  },
};

const importanceColors = {
  critical: "bg-red-100 text-red-700",
  important: "bg-amber-100 text-amber-700",
  recommended: "bg-blue-100 text-blue-700",
};

type StatusFilter =
  | "all"
  | "present"
  | "missing"
  | "partial"
  | "not_applicable";

export default function AnalysisResults({
  result,
  onUpdateItem,
}: AnalysisResultsProps) {
  // Start with all standards expanded
  const allStandardKeys = Object.keys(
    result.checklist.reduce(
      (acc, item) => {
        acc[item.standard] = true;
        return acc;
      },
      {} as Record<string, boolean>
    )
  );
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(
    new Set(allStandardKeys)
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showApplicability, setShowApplicability] = useState(false);

  // Group by standard
  const grouped = result.checklist.reduce(
    (acc, item) => {
      if (!acc[item.standard]) acc[item.standard] = [];
      acc[item.standard].push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  const toggleStandard = (std: string) => {
    const next = new Set(expandedStandards);
    if (next.has(std)) next.delete(std);
    else next.add(std);
    setExpandedStandards(next);
  };

  const toggleItem = (id: string) => {
    const next = new Set(expandedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedItems(next);
  };

  const expandAll = () => {
    setExpandedStandards(new Set(Object.keys(grouped)));
  };

  const collapseAll = () => {
    setExpandedStandards(new Set());
    setExpandedItems(new Set());
  };

  const filteredGrouped = Object.entries(grouped).reduce(
    (acc, [std, items]) => {
      const filtered =
        statusFilter === "all"
          ? items
          : items.filter((i) => i.status === statusFilter);
      if (filtered.length > 0) acc[std] = filtered;
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  const exportCSV = () => {
    const headers = [
      "Standard",
      "Paragraph",
      "Description",
      "Importance",
      "Status",
      "Page(s)",
      "Notes",
      "Evidence",
    ];
    const rows = result.checklist.map((item) => [
      item.standard,
      item.paragraph,
      `"${item.description.replace(/"/g, '""')}"`,
      item.importance,
      item.status,
      item.pages || "N/A",
      `"${item.notes.replace(/"/g, '""')}"`,
      `"${item.evidence.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "disclosure-checklist.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const { summary } = result;
  const completionRate =
    summary.total > 0
      ? Math.round(
          ((summary.present + summary.notApplicable) / summary.total) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Requirements</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{summary.present}</p>
          <p className="text-xs text-green-600 mt-1">Present</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{summary.missing}</p>
          <p className="text-xs text-red-600 mt-1">Missing</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{summary.partial}</p>
          <p className="text-xs text-amber-600 mt-1">Partial</p>
        </div>
        <div className="bg-gray-50 rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">
            {summary.notApplicable}
          </p>
          <p className="text-xs text-gray-500 mt-1">N/A</p>
        </div>
      </div>

      {/* Completion Bar */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Compliance Rate
          </span>
          <span className="text-sm font-bold text-gray-900">
            {completionRate}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              completionRate >= 80
                ? "bg-green-500"
                : completionRate >= 50
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Applicability Assessment */}
      {result.applicability && result.applicability.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <button
            onClick={() => setShowApplicability(!showApplicability)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-gray-700">
              Standards Applicability Assessment
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600">
                {result.applicability.filter((a) => a.applicable).length} applicable
              </span>
              <span className="text-xs text-gray-400">
                {result.applicability.filter((a) => !a.applicable).length} not applicable
              </span>
              {showApplicability ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>
          {showApplicability && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.applicability
                .sort((a, b) => (a.applicable === b.applicable ? 0 : a.applicable ? -1 : 1))
                .map((item) => (
                <div
                  key={item.standard}
                  className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                    item.applicable ? "bg-green-50" : "bg-gray-50"
                  }`}
                >
                  {item.applicable ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <MinusCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {item.standard}
                      </span>
                      <span className="text-xs text-gray-400">
                        {item.requirementCount} items
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
          <Filter className="w-4 h-4 text-gray-400 ml-2" />
          {(
            ["all", "missing", "partial", "present", "not_applicable"] as const
          ).map((f) => (
            <button
              key={f}
              onClick={() => {
                setStatusFilter(f);
                // Auto-expand all standards that have matching items
                if (f === "all") {
                  setExpandedStandards(new Set(Object.keys(grouped)));
                } else {
                  const matching = Object.entries(grouped)
                    .filter(([, items]) => items.some((i) => i.status === f))
                    .map(([std]) => std);
                  setExpandedStandards(new Set(matching));
                }
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                statusFilter === f
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "not_applicable"
                  ? "N/A"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={expandAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Expand All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Collapse All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Checklist by Standard */}
      <div className="space-y-3">
        {Object.entries(filteredGrouped).map(([standard, items]) => {
          const isExpanded = expandedStandards.has(standard);
          const stdMissing = items.filter(
            (i) => i.status === "missing"
          ).length;
          const stdPartial = items.filter(
            (i) => i.status === "partial"
          ).length;

          return (
            <div
              key={standard}
              className="bg-white rounded-xl border overflow-hidden"
            >
              <button
                onClick={() => toggleStandard(standard)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                )}
                <span className="font-semibold text-gray-900">{standard}</span>
                <span className="text-sm text-gray-500">
                  {items[0].standardName}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {stdMissing > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {stdMissing} missing
                    </span>
                  )}
                  {stdPartial > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {stdPartial} partial
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {items.length} items
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t divide-y">
                  {items.map((item) => {
                    const config = statusConfig[item.status];
                    const Icon = config.icon;
                    const isItemExpanded = expandedItems.has(item.id);

                    return (
                      <div key={item.id} className={`${config.bg}`}>
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="w-full flex items-start gap-3 p-3 text-left hover:bg-black/5 transition-colors"
                        >
                          <Icon
                            className={`w-5 h-5 ${config.color} shrink-0 mt-0.5`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-gray-500">
                                {item.paragraph}
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${importanceColors[item.importance]}`}
                              >
                                {item.importance}
                              </span>
                              {item.pages && item.pages !== "N/A" && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                  p. {item.pages}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 mt-1">
                              {item.description}
                            </p>
                          </div>
                          <select
                            value={item.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateItem(item.id, {
                                status: e.target
                                  .value as ChecklistItem["status"],
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs border rounded-md px-2 py-1 ${config.border} bg-white shrink-0`}
                          >
                            <option value="present">Present</option>
                            <option value="partial">Partial</option>
                            <option value="missing">Missing</option>
                            <option value="not_applicable">N/A</option>
                            <option value="unchecked">Unchecked</option>
                          </select>
                        </button>

                        {isItemExpanded && (
                          <div className="px-11 pb-3 space-y-2">
                            {item.notes && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  Notes
                                </p>
                                <p className="text-sm text-gray-700">
                                  {item.notes}
                                </p>
                              </div>
                            )}
                            {item.evidence && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  Evidence
                                </p>
                                <p className="text-sm text-gray-600 italic bg-white/70 p-2 rounded border">
                                  &ldquo;{item.evidence}&rdquo;
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                Manual Notes
                              </p>
                              <textarea
                                value={item.notes}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    notes: e.target.value,
                                  })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-sm border rounded-md p-2 bg-white"
                                rows={2}
                                placeholder="Add your own notes..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recommendations
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {result.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="text-gray-400 shrink-0">{i + 1}.</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
