"use client";

import { useEffect, useRef, useState } from "react";

interface PdfViewerProps {
  fileUrl: string;
  highlightPage?: number;
}

export default function PdfViewer({ fileUrl, highlightPage }: PdfViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState<number | undefined>(highlightPage);
  // Use a counter to force iframe reload when navigating to the same page
  const [navCounter, setNavCounter] = useState(0);

  useEffect(() => {
    if (highlightPage && highlightPage > 0) {
      setCurrentPage(highlightPage);
      setNavCounter((c) => c + 1);
    }
  }, [highlightPage]);

  // Force iframe to navigate by resetting src
  useEffect(() => {
    if (currentPage && currentPage > 0 && iframeRef.current) {
      const base = fileUrl.split("#")[0];
      // Adding a unique param forces the browser to re-navigate
      iframeRef.current.src = `${base}#page=${currentPage}&t=${navCounter}`;
    }
  }, [currentPage, navCounter, fileUrl]);

  const initialSrc = currentPage
    ? `${fileUrl.split("#")[0]}#page=${currentPage}`
    : fileUrl;

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-xl border overflow-hidden">
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">PDF Preview</span>
        {currentPage && currentPage > 0 && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            Showing page {currentPage}
          </span>
        )}
      </div>
      <iframe
        ref={iframeRef}
        src={initialSrc}
        className="flex-1 w-full min-h-[600px]"
        title="PDF Preview"
        style={{ border: "none" }}
      />
    </div>
  );
}
