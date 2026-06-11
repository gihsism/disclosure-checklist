import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { put } from "@vercel/blob";
import type { AnalysisResult } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const { rows } = await pool.query(
    `SELECT id, file_name, saved_at, result, pdf_url IS NOT NULL AS has_pdf
     FROM analyses WHERE user_id = $1 ORDER BY saved_at DESC`,
    [userId]
  );
  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.id,
      fileName: r.file_name,
      savedAt: new Date(r.saved_at).toISOString(),
      result: r.result,
      hasPdf: r.has_pdf,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const form = await req.formData();
  const fileName = String(form.get("fileName") || "Analysis");
  const resultRaw = form.get("result");
  if (typeof resultRaw !== "string") {
    return NextResponse.json({ error: "Missing result" }, { status: 400 });
  }
  let result: AnalysisResult;
  try {
    result = JSON.parse(resultRaw);
  } catch {
    return NextResponse.json({ error: "Invalid result JSON" }, { status: 400 });
  }
  const pdf = form.get("pdf");

  const id = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let pdfUrl: string | null = null;
  let pdfName: string | null = null;
  let pdfType: string | null = null;
  let pdfSize: number | null = null;

  if (pdf instanceof File && pdf.size > 0) {
    const blob = await put(`users/${userId}/${id}/${pdf.name}`, pdf, {
      access: "public",
      contentType: pdf.type || "application/pdf",
    });
    pdfUrl = blob.url;
    pdfName = pdf.name;
    pdfType = pdf.type || "application/pdf";
    pdfSize = pdf.size;
  }

  await pool.query(
    `INSERT INTO analyses (id, user_id, file_name, result, pdf_url, pdf_name, pdf_type, pdf_size)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, userId, fileName, result, pdfUrl, pdfName, pdfType, pdfSize]
  );

  return NextResponse.json({ id });
}
