"use client";

import { getStandardsList } from "@/data/ifrs-checklist";

interface StandardSelectorProps {
  selectedStandards: string[];
  onToggle: (standard: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function StandardSelector({
  selectedStandards,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: StandardSelectorProps) {
  const standards = getStandardsList();
  const allSelected = selectedStandards.length === standards.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Standards to Check
        </h3>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-2">
        {standards.map((std) => (
          <label
            key={std.id}
            className={`
              flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm
              transition-colors
              ${
                selectedStandards.includes(std.id)
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-gray-50 border border-transparent hover:bg-gray-100"
              }
            `}
          >
            <input
              type="checkbox"
              checked={selectedStandards.includes(std.id)}
              onChange={() => onToggle(std.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-gray-800">{std.id}</span>
            <span className="text-gray-500 truncate text-xs">
              {std.name}
            </span>
            <span className="ml-auto text-xs text-gray-400 shrink-0">
              {std.count}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
