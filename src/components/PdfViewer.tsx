"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface PdfViewerProps {
  fileUrl: string;
  highlightPage?: number;
}

export default function PdfViewer({ fileUrl, highlightPage }: PdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [canvasUrls, setCanvasUrls] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState<unknown>(null);

  // Jump to highlighted page when it changes
  useEffect(() => {
    if (highlightPage && highlightPage > 0) {
      setCurrentPage(highlightPage);
    }
  }, [highlightPage]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";

        const response = await fetch(fileUrl);
        const data = new Uint8Array(await response.arrayBuffer());
        const doc = await pdfjsLib.getDocument({
          data,
          useWorkerFetch: false,
          isEvalSupported: false,
        }).promise;

        if (!cancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setLoading(false);
      }
    }
    loadPdf();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc) return;
    const doc = pdfDoc as { getPage: (n: number) => Promise<{ getViewport: (opts: { scale: number }) => { width: number; height: number }; render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> };

    const cacheKey = `${currentPage}-${scale}`;
    if (canvasUrls.has(currentPage) && scale === 1.0) return;

    async function render() {
      const page = await doc.getPage(currentPage);
      const viewport = page.getViewport({ scale: scale * 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const url = canvas.toDataURL();
      setCanvasUrls((prev) => new Map(prev).set(currentPage, url));
    }
    render();
  }, [pdfDoc, currentPage, scale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border">
        <p className="text-sm text-gray-400">Loading PDF...</p>
      </div>
    );
  }

  if (!pdfDoc || totalPages === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border">
        <p className="text-sm text-gray-400">Could not load PDF preview</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-xl border overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-600 min-w-[80px] text-center">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Page */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        {canvasUrls.has(currentPage) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={canvasUrls.get(currentPage)}
            alt={`Page ${currentPage}`}
            className="shadow-lg max-w-full"
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-gray-400">Rendering...</p>
          </div>
        )}
      </div>
    </div>
  );
}
