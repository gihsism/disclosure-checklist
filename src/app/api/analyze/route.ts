import { NextRequest, NextResponse } from "next/server";
import { analyzeFinancialStatements } from "@/lib/analyze";
import { ifrsRequirements } from "@/data/ifrs-checklist";
import Anthropic from "@anthropic-ai/sdk";
import { hashRequest, getCached, setCached } from "@/lib/llm-cache";

export const maxDuration = 300; // 5 min for Vercel

const anthropic = new Anthropic();

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
    textParts.push(`[PAGE ${i}]\n${pageText}`);
  }

  await doc.destroy();
  return textParts.join("\n\n");
}

// For scanned PDFs: send the PDF directly to Claude's document API
async function extractPdfViaVision(buffer: Buffer): Promise<string> {
  const base64 = buffer.toString("base64");

  const messages: Anthropic.Messages.MessageCreateParams["messages"] = [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
        {
          type: "text",
          text: "Extract ALL text from this financial statement PDF. For each page, start with [PAGE X] marker. Preserve all numbers, tables, headings, and structure. Be thorough — include every piece of text visible on each page.",
        },
      ],
    },
  ];

  // Check cache for vision extraction
  const hash = hashRequest({ model: "claude-sonnet-4-20250514", messages, max_tokens: 16000 });
  const cached = getCached(hash);
  if (cached !== null) return cached;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    messages,
  });

  const content = response.content[0];
  if (content.type === "text") {
    setCached(hash, content.text);
    return content.text;
  }
  return "";
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
      // Try text extraction first
      text = await extractPdfText(buffer);

      // If text extraction yields very little (scanned PDF), try vision
      const wordCount = text.replace(/\[PAGE \d+\]/g, "").trim().split(/\s+/).length;
      if (wordCount < 200) {
        try {
          text = await extractPdfViaVision(buffer);
        } catch (visionErr) {
          console.error("Vision extraction failed, using sparse text:", visionErr);
          // Continue with whatever text we got
        }
      }
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

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from the uploaded file. The PDF may be image-only or corrupted." },
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
    const { checklist, applicability } = await analyzeFinancialStatements(text, requirements);

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
      applicability,
      summary,
      recommendations,
    });
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
