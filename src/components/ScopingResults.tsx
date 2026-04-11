"use client";

import { ScopingResult } from "@/types/scoping";
import {
  Building2,
  Globe,
  Calendar,
  Coins,
  Users,
  AlertTriangle,
  CheckCircle,
  MinusCircle,
  Target,
  FileText,
} from "lucide-react";

interface ScopingResultsProps {
  scoping: ScopingResult;
  selectedStandards: string[];
  onToggleStandard: (standard: string) => void;
  onSelectApplicable: () => void;
  onProceed: () => void;
}

export default function ScopingResults({
  scoping,
  selectedStandards,
  onToggleStandard,
  onSelectApplicable,
  onProceed,
}: ScopingResultsProps) {
  const { entity, keyFigures, significantAreas, riskAreas, applicableStandards, notApplicableStandards, summary } = scoping;

  return (
    <div className="space-y-5">
      {/* Entity Profile */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Entity Profile
        </h3>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{entity.name}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                <Building2 className="w-3 h-3" /> {entity.type}
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
                <Target className="w-3 h-3" /> {entity.industry}
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                <Globe className="w-3 h-3" /> {entity.country}
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                <Calendar className="w-3 h-3" /> {entity.reportingPeriod}
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                <Coins className="w-3 h-3" /> {entity.presentationCurrency}
              </span>
              {entity.auditor && (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                  <FileText className="w-3 h-3" /> {entity.auditor}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-3">{summary}</p>
            <p className="text-xs text-gray-400 mt-1">Framework: {entity.framework}</p>
          </div>
        </div>
      </div>

      {/* Key Figures */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Assets", value: keyFigures.totalAssets },
          { label: "Revenue", value: keyFigures.totalRevenue },
          { label: "Net Income", value: keyFigures.netIncome },
          { label: "Equity", value: keyFigures.totalEquity },
          { label: "Employees", value: keyFigures.employees, icon: Users },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border p-3 text-center">
            <p className="text-sm font-bold text-gray-900 truncate" title={item.value}>
              {item.value || "—"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Significant Areas & Risk Areas side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Significant Areas */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Target className="w-4 h-4" /> Significant Areas
          </h3>
          <div className="space-y-2">
            {significantAreas.map((area, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">{area.area}</p>
                <p className="text-xs text-gray-500 mt-0.5">{area.description}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {area.relevantStandards.map((std) => (
                    <span key={std} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {std}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Areas */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Disclosure Risk Areas
          </h3>
          <div className="space-y-2">
            {riskAreas.map((risk, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Standards Scope */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Standards Scope — Select which to check
          </h3>
          <button
            onClick={onSelectApplicable}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Select Applicable Only
          </button>
        </div>

        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">
            Applicable ({applicableStandards.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {applicableStandards.map((item) => (
              <label
                key={item.standard}
                className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                  selectedStandards.includes(item.standard)
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50 border border-transparent hover:bg-gray-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedStandards.includes(item.standard)}
                  onChange={() => onToggleStandard(item.standard)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="font-medium text-gray-800 text-xs">{item.standard}</span>
                <span className="text-[10px] text-gray-400 truncate">{item.reason}</span>
              </label>
            ))}
          </div>
        </div>

        {notApplicableStandards.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Not Applicable ({notApplicableStandards.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {notApplicableStandards.map((item) => (
                <label
                  key={item.standard}
                  className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                    selectedStandards.includes(item.standard)
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 border border-transparent hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStandards.includes(item.standard)}
                    onChange={() => onToggleStandard(item.standard)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <MinusCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-500 text-xs">{item.standard}</span>
                  <span className="text-[10px] text-gray-400 truncate">{item.reason}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proceed Button */}
      <button
        onClick={onProceed}
        disabled={selectedStandards.length === 0}
        className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
          selectedStandards.length === 0
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-200"
        }`}
      >
        Run Disclosure Checklist Against {selectedStandards.length} Standards
      </button>
    </div>
  );
}
