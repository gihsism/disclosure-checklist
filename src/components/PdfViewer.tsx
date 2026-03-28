"use client";

import { useEffect, useRef } from "react";

interface PdfViewerProps {
  fileUrl: string;
  highlightPage?: number;
}

export default function PdfViewer({ fileUrl, highlightPage }: PdfViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Jump to page when highlightPage changes
  useEffect(() => {
    if (highlightPage && highlightPage > 0 && iframeRef.current) {
      // Most PDF viewers support #page=N fragment
      const base = fileUrl.split("#")[0];
      iframeRef.current.src = `${base}#page=${highlightPage}`;
    }
  }, [highlightPage, fileUrl]);

  const src = highlightPage ? `${fileUrl.split("#")[0]}#page=${highlightPage}` : fileUrl;

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-xl border overflow-hidden">
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">PDF Preview</span>
        {highlightPage && (
          <span className="text-xs text-blue-600 font-medium">
            Page {highlightPage}
          </span>
        )}
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        className="flex-1 w-full"
        title="PDF Preview"
      />
    </div>
  );
}
