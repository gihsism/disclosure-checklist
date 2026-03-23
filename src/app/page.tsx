"use client";

import { useState, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import StandardSelector from "@/components/StandardSelector";
import AnalysisResults from "@/components/AnalysisResults";
import { AnalysisResult, ChecklistItem } from "@/types";
import { getStandardsList } from "@/data/ifrs-checklist";
import { FileSearch, Loader2 } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedStandards, setSelectedStandards] = useState<string[]>(
    getStandardsList().map((s) => s.id)
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const allStandards = getStandardsList().map((s) => s.id);

  const handleToggle = (standard: string) => {
    setSelectedStandards((prev) =>
      prev.includes(standard)
        ? prev.filter((s) => s !== standard)
        : [...prev, standard]
    );
  };

  const handleAnalyze = async () => {
    if (!file || selectedStandards.length === 0) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setProgress("Uploading and extracting text...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("framework", "ifrs");
      formData.append("standards", selectedStandards.join(","));

      setProgress(
        "Analyzing disclosures against " +
          selectedStandards.length +
          " standards... This may take a few minutes."
      );

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      let data: AnalysisResult;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server error — check that the API key is configured correctly.");
      }

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || "Analysis failed");
      }
      setResult(data);
      setProgress("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setProgress("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateItem = useCallback(
    (id: string, updates: Partial<ChecklistItem>) => {
      if (!result) return;
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
        return { ...prev, checklist: newChecklist, summary };
      });
    },
    [result]
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

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {!result ? (
          <>
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
                onFileSelect={setFile}
                selectedFile={file}
                isAnalyzing={isAnalyzing}
              />

              <StandardSelector
                selectedStandards={selectedStandards}
                onToggle={handleToggle}
                onSelectAll={() => setSelectedStandards(allStandards)}
                onDeselectAll={() => setSelectedStandards([])}
              />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || selectedStandards.length === 0 || isAnalyzing}
                className={`
                  w-full py-3 px-6 rounded-xl font-semibold text-white
                  transition-all duration-200
                  ${
                    !file || selectedStandards.length === 0 || isAnalyzing
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-200"
                  }
                `}
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  `Analyze Against ${selectedStandards.length} Standards`
                )}
              </button>

              {progress && (
                <p className="text-sm text-center text-blue-600 animate-pulse">
                  {progress}
                </p>
              )}
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
        ) : (
          <>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                &larr; New Analysis
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                Analysis Results
              </h2>
            </div>
            <AnalysisResults
              result={result}
              onUpdateItem={handleUpdateItem}
            />
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
