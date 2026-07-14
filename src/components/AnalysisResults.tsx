"use client";

import { useState } from "react";
import { ChecklistItem, AnalysisResult } from "@/types";
import { useReviewerName } from "@/lib/useReviewerName";
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
  onBulkApprove?: (ids: string[], approved: boolean, reviewer: string) => void;
  onPageClick?: (page: string, evidence?: string) => void;
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
  onBulkApprove,
  onPageClick,
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
  const [reviewerName, setReviewerName] = useReviewerName();

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
      "Approved",
      "Reviewer",
      "Review Date",
      "Review Comment",
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
      item.review?.approved ? "Yes" : "No",
      item.review?.reviewer || "",
      item.review?.reviewedAt ? new Date(item.review.reviewedAt).toLocaleDateString() : "",
      `"${(item.review?.comment || "").replace(/"/g, '""')}"`,
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

  const approvedCount = result.checklist.filter((c) => c.review?.approved).length;
  const applicableCount = result.checklist.filter((c) => c.status !== "not_applicable").length;
  const approvalRate = applicableCount > 0 ? Math.round((approvedCount / applicableCount) * 100) : 0;

  // Bulk sign-off across the whole report: applicable items split by state.
  const unapprovedApplicableIds = result.checklist
    .filter((c) => c.status !== "not_applicable" && !c.review?.approved)
    .map((c) => c.id);
  const approvedApplicableIds = result.checklist
    .filter((c) => c.status !== "not_applicable" && c.review?.approved)
    .map((c) => c.id);

  // Approve — or reset — every applicable item in one group (respects filter).
  const setGroupApproval = (items: ChecklistItem[], approved: boolean) => {
    const ids = items
      .filter(
        (i) =>
          i.status !== "not_applicable" && Boolean(i.review?.approved) !== approved
      )
      .map((i) => i.id);
    if (ids.length) onBulkApprove?.(ids, approved, reviewerName);
  };

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
        {/* Approval progress */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm font-medium text-gray-700">
            Reviewer Approval
          </span>
          <span className="text-sm font-bold text-gray-900">
            {approvedCount} / {applicableCount} ({approvalRate}%)
          </span>
        </div>
        {/* Reviewer name — set once, reused on every sign-off */}
        <div className="flex flex-wrap items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          <label htmlFor="reviewer-name" className="text-xs text-gray-500 shrink-0">
            Your name:
          </label>
          <input
            id="reviewer-name"
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            className="text-sm border rounded-md px-2 py-1 bg-white flex-1 min-w-[10rem] max-w-xs"
            placeholder="Enter once — used for all approvals"
          />
          {unapprovedApplicableIds.length > 0 ? (
            <button
              onClick={() => onBulkApprove?.(unapprovedApplicableIds, true, reviewerName)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
              title="Approve every applicable item that isn't approved yet"
            >
              Approve all remaining ({unapprovedApplicableIds.length})
            </button>
          ) : (
            <button
              onClick={() => onBulkApprove?.(approvedApplicableIds, false, reviewerName)}
              disabled={approvedApplicableIds.length === 0}
              className="text-xs font-medium px-3 py-1.5 rounded-md border shrink-0 bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:text-gray-300 disabled:border-gray-200"
              title="Clear every approval in the report"
            >
              {approvedApplicableIds.length === 0 ? "Nothing to approve" : "Unapprove all"}
            </button>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div
            className="h-2 rounded-full transition-all duration-500 bg-emerald-500"
            style={{ width: `${approvalRate}%` }}
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
          const stdApplicable = items.filter(
            (i) => i.status !== "not_applicable"
          ).length;
          const stdRemaining = items.filter(
            (i) => i.status !== "not_applicable" && !i.review?.approved
          ).length;

          return (
            <div
              key={standard}
              className="bg-white rounded-xl border overflow-hidden"
            >
              <div className="w-full flex items-center">
                <button
                  onClick={() => toggleStandard(standard)}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors flex-1 min-w-0 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                  <span className="font-semibold text-gray-900 shrink-0">{standard}</span>
                  <span className="text-sm text-gray-500 truncate">
                    {items[0].standardName}
                  </span>
                  <div className="ml-auto flex items-center gap-2 shrink-0">
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
                {stdApplicable > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroupApproval(items, stdRemaining > 0);
                    }}
                    className={`text-xs font-medium px-2.5 py-1 mr-3 rounded-md border shrink-0 ${
                      stdRemaining > 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                    title={
                      stdRemaining > 0
                        ? "Approve all applicable items in this standard"
                        : "Clear all approvals in this standard"
                    }
                  >
                    {stdRemaining > 0 ? `Approve all (${stdRemaining})` : "Unapprove all"}
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="border-t divide-y">
                  {items.map((item) => {
                    const config = statusConfig[item.status];
                    const Icon = config.icon;
                    const isItemExpanded = expandedItems.has(item.id);

                    return (
                      <div key={item.id} className={`${config.bg}`}>
                        <button
                          onClick={() => {
                            toggleItem(item.id);
                            // Navigate PDF to this item's page and highlight evidence
                            if (onPageClick && item.pages && item.pages !== "N/A") {
                              onPageClick(item.pages, item.evidence);
                            }
                          }}
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
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium ${onPageClick ? "cursor-pointer hover:bg-blue-200" : ""}`}
                                  onClick={(e) => {
                                    if (onPageClick) {
                                      e.stopPropagation();
                                      onPageClick(item.pages, item.evidence);
                                    }
                                  }}
                                >
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
                          {/* Approval indicator on collapsed row */}
                          {item.review?.approved && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium shrink-0" title={`Approved by ${item.review.reviewer}`}>
                              Approved
                            </span>
                          )}
                        </button>

                        {isItemExpanded && (
                          <div className="px-11 pb-3 space-y-3">
                            {item.notes && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  AI Assessment
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

                            {/* Review / Approval — one tick, signed with your remembered name */}
                            <div className={`rounded-lg border p-3 ${item.review?.approved ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"}`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={item.review?.approved || false}
                                    onChange={(e) => {
                                      const newApproved = e.target.checked;
                                      onUpdateItem(item.id, {
                                        review: {
                                          approved: newApproved,
                                          reviewer: item.review?.reviewer || reviewerName,
                                          reviewedAt: newApproved ? new Date().toISOString() : "",
                                          comment: item.review?.comment || "",
                                        },
                                      });
                                    }}
                                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                  />
                                  <span className={`text-sm font-medium ${item.review?.approved ? "text-emerald-700" : "text-gray-700"}`}>
                                    {item.review?.approved ? "Approved" : "Approve"}
                                  </span>
                                </label>
                                {item.review?.approved && item.review.reviewedAt && (
                                  <span className="text-xs text-emerald-600 text-right">
                                    {item.review.reviewer || reviewerName || "—"} ·{" "}
                                    {new Date(item.review.reviewedAt).toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>
                              {item.review?.approved && !reviewerName && !item.review.reviewer && (
                                <p className="text-xs text-amber-600 mt-1">
                                  Set “Your name” at the top so approvals are signed.
                                </p>
                              )}
                              <input
                                type="text"
                                value={item.review?.comment || ""}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    review: {
                                      approved: item.review?.approved || false,
                                      reviewer: item.review?.reviewer || reviewerName,
                                      reviewedAt: item.review?.reviewedAt || "",
                                      comment: e.target.value,
                                    },
                                  })
                                }
                                className="w-full text-sm border rounded-md px-2 py-1 bg-white mt-2"
                                placeholder="Optional note"
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
