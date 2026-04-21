"use client";

import { useState, useCallback, useRef } from "react";
import FileUpload from "@/components/FileUpload";
import AnalysisResults from "@/components/AnalysisResults";
import { AnalysisResult, ChecklistItem } from "@/types";
import { getStandardsList } from "@/data/ifrs-checklist";
import { FileSearch, Loader2, Save, Upload as UploadIcon, PanelLeftClose, PanelLeft, Archive, ArchiveRestore } from "lucide-react";
import PdfViewer from "@/components/PdfViewer";
import ReportExport from "@/components/ReportExport";
import AnalysisHistory from "@/components/AnalysisHistory";
import ScopingResults from "@/components/ScopingResults";
import { ScopingResult } from "@/types/scoping";
import {
  saveAnalysis,
  loadAnalysis,
  updateAnalysisResult,
  pdfRecordToFile,
  exportAllAsZip,
  importFromZip,
  listAnalyses,
} from "@/lib/analysis-store";

type AppStep = "upload" | "scoping" | "results";

export default function Home() {
  const [step, setStep] = useState<AppStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(true);
  const [highlightPage, setHighlightPage] = useState<number | undefined>();
  const [highlightEvidence, setHighlightEvidence] = useState<string | undefined>();
  const [pageNavCounter, setPageNavCounter] = useState(0);
  const [selectedStandards, setSelectedStandards] = useState<string[]>(
    getStandardsList().map((s) => s.id)
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScoping, setIsScoping] = useState(false);
  const [scopingResult, setScopingResult] = useState<ScopingResult | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [elapsed, setElapsed] = useState<number>(0);
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const loadFileRef = useRef<HTMLInputElement>(null);
  const zipImportRef = useRef<HTMLInputElement>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);


  // Normalize old results to the current schema
  const normalizeResult = (data: Record<string, unknown>): AnalysisResult => {
    const checklist = (data.checklist || []) as AnalysisResult["checklist"];

    // Ensure every checklist item has the `pages` field
    const normalizedChecklist = checklist.map((item) => ({
      ...item,
      pages: item.pages || "N/A",
    }));

    // Build applicability from checklist if not present
    let applicability = data.applicability as AnalysisResult["applicability"] | undefined;
    if (!applicability || applicability.length === 0) {
      const stdMap: Record<string, { name: string; applicable: boolean; count: number }> = {};
      for (const item of normalizedChecklist) {
        if (!stdMap[item.standard]) {
          stdMap[item.standard] = {
            name: item.standardName,
            applicable: item.status !== "not_applicable",
            count: 0,
          };
        }
        stdMap[item.standard].count++;
        if (item.status !== "not_applicable") {
          stdMap[item.standard].applicable = true;
        }
      }
      applicability = Object.entries(stdMap).map(([std, info]) => ({
        standard: std,
        standardName: info.name,
        applicable: info.applicable,
        reason: info.applicable ? "Applicable based on analysis" : "All items marked N/A",
        requirementCount: info.count,
      }));
    }

    // Rebuild summary from checklist
    const summary = {
      total: normalizedChecklist.length,
      present: normalizedChecklist.filter((c) => c.status === "present").length,
      missing: normalizedChecklist.filter((c) => c.status === "missing").length,
      partial: normalizedChecklist.filter((c) => c.status === "partial").length,
      notApplicable: normalizedChecklist.filter((c) => c.status === "not_applicable").length,
    };

    return {
      framework: (data.framework as string) || "ifrs",
      checklist: normalizedChecklist,
      applicability,
      summary,
      recommendations: (data.recommendations || []) as string[],
    };
  };

  const loadAnalysisById = async (id: string) => {
    const record = await loadAnalysis(id);
    if (!record) return;
    setCurrentAnalysisId(record.id);
    setResult(normalizeResult(record.result as unknown as Record<string, unknown>));
    setStep("results");
    if (record.pdf) {
      const f = pdfRecordToFile(record.pdf);
      setFile(f);
      setPdfUrl(URL.createObjectURL(f));
      setShowPdf(true);
    }
  };

  const handlePdfAttach = (f: File) => {
    setFile(f);
    setPdfUrl(URL.createObjectURL(f));
    setShowPdf(true);
  };

  const saveResultToFile = () => {
    if (!result) return;
    const data = { ...result, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disclosure-checklist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadHistoryZip = async () => {
    setZipMessage(null);
    setZipBusy(true);
    try {
      const summaries = await listAnalyses();
      if (summaries.length === 0) {
        setZipMessage("No analyses in history yet.");
        return;
      }
      const blob = await exportAllAsZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `disclosure-checklist-history-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setZipMessage(`Exported ${summaries.length} analyses.`);
    } catch (err) {
      setZipMessage(
        err instanceof Error ? `Export failed: ${err.message}` : "Export failed."
      );
    } finally {
      setZipBusy(false);
    }
  };

  const importHistoryZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setZipMessage(null);
    setZipBusy(true);
    try {
      const { imported, skipped } = await importFromZip(f);
      setZipMessage(`Imported ${imported} analyses${skipped ? ` (${skipped} skipped — already present)` : ""}.`);
      setHistoryRefreshKey((k) => k + 1);
    } catch (err) {
      setZipMessage(
        err instanceof Error ? `Import failed: ${err.message}` : "Import failed."
      );
    } finally {
      setZipBusy(false);
    }
  };

  const loadResultFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.checklist) {
          setCurrentAnalysisId(null);
          setResult(normalizeResult(data));
          setStep("results");
        } else {
          setError("Invalid results file.");
        }
      } catch {
        setError("Could not parse the results file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleToggle = (standard: string) => {
    setSelectedStandards((prev) =>
      prev.includes(standard)
        ? prev.filter((s) => s !== standard)
        : [...prev, standard]
    );
  };

  const handleScope = async () => {
    if (!file) return;
    setIsScoping(true);
    setError(null);
    setProgress("Running scoping analysis...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/scope", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      let data: ScopingResult;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Scoping analysis failed — server error.");
      }

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || "Scoping failed");
      }

      setScopingResult(data);
      // Pre-select applicable standards
      const applicable = data.applicableStandards.map((s) => s.standard);
      setSelectedStandards(applicable);
      setStep("scoping");
      setProgress("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Scoping failed";
      setError(message);
      setProgress("");
    } finally {
      setIsScoping(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file || selectedStandards.length === 0) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setElapsed(0);
    setProgress("Uploading and extracting text...");

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    setTimerRef(timer);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("framework", "ifrs");
      formData.append("standards", selectedStandards.join(","));

      setProgress("Analyzing disclosures against " + selectedStandards.length + " standards...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      let data: AnalysisResult;
      try {
        data = JSON.parse(text);
      } catch {
        if (text.includes("FUNCTION_INVOCATION_TIMEOUT") || text.includes("Task timed out")) {
          throw new Error("Analysis timed out — try selecting fewer standards (10-15 at a time) for large documents.");
        }
        throw new Error("Server error — the analysis may have timed out. Try selecting fewer standards.");
      }

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || "Analysis failed");
      }
      const resultToSave = { ...data, scoping: scopingResult };
      setResult(resultToSave);
      setStep("results");
      if (pdfUrl) setShowPdf(true);

      try {
        const id = await saveAnalysis({
          fileName: file?.name || "Analysis",
          result: resultToSave,
          file: file ?? undefined,
        });
        setCurrentAnalysisId(id);
        setHistoryRefreshKey((k) => k + 1);
        console.log(`[analysis-store] saved ${id} with${file ? "" : "out"} PDF`);
      } catch (e) {
        console.error("[analysis-store] save failed:", e);
      }

      setProgress("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setProgress("");
    } finally {
      setIsAnalyzing(false);
      if (timerRef) clearInterval(timerRef);
      setTimerRef(null);
    }
  };

  const handleUpdateItem = useCallback(
    (id: string, updates: Partial<ChecklistItem>) => {
      setResult((prev) => {
        if (!prev) return prev;
        const newChecklist = prev.checklist.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        );
        const summary = {
          total: newChecklist.length,
          present: newChecklist.filter((c) => c.status === "present").length,
          missing: newChecklist.filter((c) => c.status === "missing").length,
          partial: newChecklist.filter((c) => c.status === "partial").length,
          notApplicable: newChecklist.filter(
            (c) => c.status === "not_applicable"
          ).length,
        };
        const next = { ...prev, checklist: newChecklist, summary };
        if (currentAnalysisId) {
          updateAnalysisResult(currentAnalysisId, next).then(() =>
            setHistoryRefreshKey((k) => k + 1)
          );
        }
        return next;
      });
    },
    [currentAnalysisId]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <FileSearch className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Disclosure Checklist
            </h1>
            <p className="text-xs text-gray-500">
              IFRS Disclosure Compliance Analyzer
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              IFRS
            </span>
            <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-full">
              US GAAP (coming soon)
            </span>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 py-8 space-y-6 ${step === "results" && pdfUrl && showPdf ? "max-w-[1600px]" : "max-w-6xl"}`}>
        {step === "upload" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => loadFileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <UploadIcon className="w-4 h-4" />
                Load from File
              </button>
              <button
                onClick={downloadHistoryZip}
                disabled={zipBusy}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Archive className="w-4 h-4" />
                Download history (.zip)
              </button>
              <button
                onClick={() => zipImportRef.current?.click()}
                disabled={zipBusy}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ArchiveRestore className="w-4 h-4" />
                Restore from .zip
              </button>
              {zipMessage && (
                <span className="text-xs text-gray-600">{zipMessage}</span>
              )}
              <input
                ref={loadFileRef}
                type="file"
                accept=".json"
                onChange={loadResultFromFile}
                className="hidden"
              />
              <input
                ref={zipImportRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={importHistoryZip}
                className="hidden"
              />
            </div>

            <AnalysisHistory onLoad={loadAnalysisById} refreshKey={historyRefreshKey} />

            {/* Upload Section */}
            <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Upload Financial Statements
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload your annual report or financial statements PDF. The AI
                  will analyze it against IFRS disclosure requirements.
                </p>
              </div>

              <FileUpload
                onFileSelect={(f) => {
                  setFile(f);
                  if (f && f.name.endsWith(".pdf")) {
                    setPdfUrl(URL.createObjectURL(f));
                  } else {
                    setPdfUrl(null);
                  }
                }}
                selectedFile={file}
                isAnalyzing={isAnalyzing}
              />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleScope}
                disabled={!file || isScoping}
                className={`
                  w-full py-3 px-6 rounded-xl font-semibold text-white
                  transition-all duration-200
                  ${
                    !file || isScoping
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-200"
                  }
                `}
              >
                {isScoping ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {progress || "Analyzing..."}
                  </span>
                ) : (
                  "Start Scoping Analysis"
                )}
              </button>

            </section>

            {/* How it works */}
            <section className="grid md:grid-cols-3 gap-4">
              {[
                {
                  step: "1",
                  title: "Upload",
                  desc: "Drop your financial statements PDF — annual reports, interim statements, or standalone financials.",
                },
                {
                  step: "2",
                  title: "Analyze",
                  desc: "AI reads the entire document and checks each disclosure requirement from Big 4 checklists.",
                },
                {
                  step: "3",
                  title: "Review",
                  desc: "Get a detailed checklist with status, evidence, and recommendations. Export to CSV.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="bg-white rounded-xl border p-5 space-y-2"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              ))}
            </section>
          </>
        ) : step === "scoping" && scopingResult ? (
          <>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setStep("upload"); setScopingResult(null); }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                &larr; Back to Upload
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                Scoping Analysis
              </h2>
            </div>

            <ScopingResults
              scoping={scopingResult}
              selectedStandards={selectedStandards}
              onToggleStandard={handleToggle}
              onSelectApplicable={() => {
                setSelectedStandards(scopingResult.applicableStandards.map((s) => s.standard));
              }}
              onProceed={handleAnalyze}
              onUpdateReview={(review) => {
                setScopingResult({ ...scopingResult, review });
              }}
            />

            {isAnalyzing && (
              <div className="text-center space-y-2">
                <p className="text-sm text-blue-600 animate-pulse">
                  {progress}
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                  <span>
                    Elapsed: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>
                    Estimated: ~{Math.max(1, Math.ceil(selectedStandards.length * 0.15))}-{Math.ceil(selectedStandards.length * 0.25)} min
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                {error}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  setScopingResult(null);
                  setStep("upload");
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                &larr; New Analysis
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                Analysis Results
              </h2>
              <div className="ml-auto flex items-center gap-2">
                {result && <ReportExport result={result} />}
                <button
                  onClick={saveResultToFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save JSON
                </button>
                {pdfUrl ? (
                  <button
                    onClick={() => setShowPdf(!showPdf)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {showPdf ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
                    {showPdf ? "Hide PDF" : "Show PDF"}
                  </button>
                ) : (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer">
                    <PanelLeft className="w-3.5 h-3.5" />
                    Attach PDF
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePdfAttach(f);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Attach PDF prompt when loaded from history */}
            {!pdfUrl && result && (
              <label className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                <PanelLeft className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">
                    Attach the original PDF for side-by-side view
                  </p>
                  <p className="text-xs text-blue-600">
                    Select the PDF to view it alongside the checklist with page navigation
                  </p>
                </div>
                <span className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg shrink-0">
                  Select PDF
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePdfAttach(f);
                  }}
                />
              </label>
            )}

            {/* Side-by-side layout */}
            <div className={`${pdfUrl && showPdf ? "grid grid-cols-2 gap-4" : ""}`}>
              {pdfUrl && showPdf && (
                <div className="sticky top-20 h-[calc(100vh-120px)]">
                  <PdfViewer fileUrl={pdfUrl} highlightPage={highlightPage} highlightText={highlightEvidence} navKey={pageNavCounter} />
                </div>
              )}
              <div>
                {result && <AnalysisResults
                  result={result}
                  onUpdateItem={handleUpdateItem}
                  onPageClick={(page, evidence) => {
                    if (page && page !== "N/A") {
                      const p = parseInt(page.split(/[-,]/)[0].trim());
                      if (!isNaN(p)) {
                        setHighlightPage(p);
                        setHighlightEvidence(evidence || undefined);
                        setPageNavCounter((c) => c + 1);
                      }
                    }
                  }}
                />}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6 text-center text-xs text-gray-400">
        <p>
          Disclosure Checklist — Based on Big 4 IFRS disclosure checklists
          (Deloitte, PwC, EY, KPMG)
        </p>
        <p className="mt-1">
          AI-powered analysis. Always review results with a qualified auditor.
        </p>
      </footer>
    </div>
  );
}
