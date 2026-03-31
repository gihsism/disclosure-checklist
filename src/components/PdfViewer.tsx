"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PdfViewerProps {
  fileUrl: string;
  highlightPage?: number;
  navKey?: number; // incrementing key to force navigation even to same page
}

export default function PdfViewer({ fileUrl, highlightPage, navKey }: PdfViewerProps) {
  // Key forces a full remount of the embed element when page changes
  const [embedKey, setEmbedKey] = useState(0);
  const [targetPage, setTargetPage] = useState<number>(highlightPage || 1);

  // Navigate when highlightPage or navKey changes
  useEffect(() => {
    if (highlightPage && highlightPage > 0) {
      setTargetPage(highlightPage);
      setEmbedKey((k) => k + 1); // force remount every time
    }
  }, [highlightPage, navKey]);

  const goToPage = (page: number) => {
    if (page >= 1) {
      setTargetPage(page);
      setEmbedKey((k) => k + 1);
    }
  };

  const base = fileUrl.split("#")[0];
  const src = `${base}#page=${targetPage}`;

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-xl border overflow-hidden">
      {/* Controls */}
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(targetPage - 1)}
            disabled={targetPage <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="number"
            value={targetPage}
            onChange={(e) => {
              const p = parseInt(e.target.value);
              if (!isNaN(p) && p >= 1) goToPage(p);
            }}
            className="w-12 text-center text-xs border rounded px-1 py-0.5"
            min={1}
          />
          <button
            onClick={() => goToPage(targetPage + 1)}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {highlightPage && highlightPage > 0 && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            Jumped to page {highlightPage}
          </span>
        )}
      </div>
      {/* PDF embed — key forces full remount on page change */}
      <embed
        key={embedKey}
        src={src}
        type="application/pdf"
        className="flex-1 w-full min-h-[600px]"
      />
    </div>
  );
}
