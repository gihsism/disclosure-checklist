import { NextRequest, NextResponse } from "next/server";
import { runScopingAnalysis } from "@/lib/scoping";

export const maxDuration = 120;

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let text: string;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.name.endsWith(".pdf")) {
      text = await extractPdfText(buffer);
    } else {
      text = buffer.toString("utf-8");
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract sufficient text." },
        { status: 400 }
      );
    }

    const scoping = await runScopingAnalysis(text);
    return NextResponse.json(scoping);
  } catch (error: unknown) {
    console.error("Scoping error:", error);
    const message = error instanceof Error ? error.message : "Scoping analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
