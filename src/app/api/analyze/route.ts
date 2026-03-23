import { NextRequest, NextResponse } from "next/server";
import { analyzeFinancialStatements } from "@/lib/analyze";
import { ifrsRequirements } from "@/data/ifrs-checklist";
export const maxDuration = 300; // 5 min for Vercel

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");
    textParts.push(pageText);
  }

  await doc.destroy();
  return textParts.join("\n\n");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const framework = (formData.get("framework") as string) || "ifrs";
    const selectedStandards = formData.get("standards") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Extract text from file
    let text: string;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.name.endsWith(".pdf")) {
      text = await extractPdfText(buffer);
    } else if (
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".csv")
    ) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload a PDF or text file." },
        { status: 400 }
      );
    }

    if (!text || text.trim().length < 100) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from the uploaded file." },
        { status: 400 }
      );
    }

    // Filter requirements by selected standards
    let requirements = ifrsRequirements;
    if (selectedStandards) {
      const standards = selectedStandards.split(",").map((s) => s.trim());
      if (standards.length > 0) {
        requirements = ifrsRequirements.filter((r) =>
          standards.includes(r.standard)
        );
      }
    }

    if (framework !== "ifrs") {
      return NextResponse.json(
        { error: "Only IFRS framework is currently supported." },
        { status: 400 }
      );
    }

    // Run analysis
    const checklist = await analyzeFinancialStatements(text, requirements);

    const summary = {
      total: checklist.length,
      present: checklist.filter((c) => c.status === "present").length,
      missing: checklist.filter((c) => c.status === "missing").length,
      partial: checklist.filter((c) => c.status === "partial").length,
      notApplicable: checklist.filter((c) => c.status === "not_applicable")
        .length,
    };

    const recommendations = checklist
      .filter((c) => c.status === "missing" || c.status === "partial")
      .sort((a, b) => {
        const order = { critical: 0, important: 1, recommended: 2 };
        return order[a.importance] - order[b.importance];
      })
      .map(
        (c) =>
          `[${c.importance.toUpperCase()}] ${c.standard} ${c.paragraph}: ${c.description}${c.notes ? ` — ${c.notes}` : ""}`
      );

    return NextResponse.json({
      framework,
      checklist,
      summary,
      recommendations,
    });
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
