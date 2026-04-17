"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface PdfViewerProps {
  fileUrl: string;
  highlightPage?: number;
  highlightText?: string; // evidence text to highlight on the page
  navKey?: number;
}

export default function PdfViewer({ fileUrl, highlightPage, highlightText, navKey }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(highlightPage || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [pdfDoc, setPdfDoc] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setIsLoading(true);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url
        ).toString();

        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setIsLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Navigate when highlightPage changes
  useEffect(() => {
    if (highlightPage && highlightPage > 0) {
      setCurrentPage(highlightPage);
    }
  }, [highlightPage, navKey]);

  // Render current page with highlighting
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    const doc = pdfDoc as { getPage: (n: number) => Promise<{
      getViewport: (opts: { scale: number }) => { width: number; height: number; scale: number };
      render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[]; width: number; height?: number }> }>;
    }> };

    try {
      const page = await doc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render the page
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Highlight evidence text if provided
      if (highlightText && highlightText.length > 3) {
        const textContent = await page.getTextContent();
        const items = textContent.items;

        // Normalize search text
        const searchTerms = highlightText
          .toLowerCase()
          .replace(/[""'']/g, "")
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 15); // use first 15 meaningful words

        if (searchTerms.length > 0) {
          // Find text items that match
          const matchedItems: Array<{ transform: number[]; width: number; height: number }> = [];

          for (const item of items) {
            if (!("str" in item) || !item.str) continue;
            const itemText = item.str.toLowerCase();

            // Check if this text item contains any search terms
            const matchCount = searchTerms.filter(term => itemText.includes(term)).length;
            if (matchCount > 0 || (itemText.length > 5 && searchTerms.some(term => term.includes(itemText)))) {
              matchedItems.push({
                transform: item.transform,
                width: item.width,
                height: item.height || 12,
              });
            }
          }

          // Draw highlights
          if (matchedItems.length > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = "#FBBF24"; // amber/yellow highlight

            for (const item of matchedItems) {
              // PDF text transforms: [scaleX, skewX, skewY, scaleY, translateX, translateY]
              const tx = item.transform[4] * scale;
              const ty = viewport.height - (item.transform[5] * scale);
              const w = item.width * scale;
              const h = (item.height || 12) * scale;

              ctx.fillRect(tx, ty - h, w, h + 2);
            }

            ctx.restore();

            // Scroll to first highlight
            if (matchedItems.length > 0 && containerRef.current) {
              const firstY = viewport.height - (matchedItems[0].transform[5] * scale);
              containerRef.current.scrollTop = Math.max(0, firstY - 100);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to render page:", err);
    }
  }, [pdfDoc, currentPage, scale, highlightText]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-xl border overflow-hidden">
      {/* Controls */}
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="number"
            value={currentPage}
            onChange={(e) => {
              const p = parseInt(e.target.value);
              if (!isNaN(p)) goToPage(p);
            }}
            className="w-12 text-center text-xs border rounded px-1 py-0.5"
            min={1}
            max={totalPages}
          />
          <span className="text-xs text-gray-400">/ {totalPages}</span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {highlightText && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium truncate max-w-48">
            Highlighting evidence
          </span>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-200 flex justify-center p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-500">Loading PDF...</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="shadow-lg" />
        )}
      </div>
    </div>
  );
}
