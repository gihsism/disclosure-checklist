import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { del } from "@vercel/blob";
import type { AnalysisResult } from "@/types";

async function requireUserId() {
  const session = await auth();
  if (!session?.user) return null;
  return Number(session.user.id);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const { rows } = await pool.query(
    `SELECT id, file_name, saved_at, result, pdf_url, pdf_name, pdf_type, pdf_size
     FROM analyses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const r = rows[0];
  return NextResponse.json({
    id: r.id,
    fileName: r.file_name,
    savedAt: new Date(r.saved_at).toISOString(),
    result: r.result,
    pdf: r.pdf_url
      ? { url: r.pdf_url, name: r.pdf_name, type: r.pdf_type, size: r.pdf_size }
      : null,
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as { result?: AnalysisResult };
  if (!body.result) {
    return NextResponse.json({ error: "Missing result" }, { status: 400 });
  }
  const res = await pool.query(
    `UPDATE analyses SET result = $1 WHERE id = $2 AND user_id = $3`,
    [body.result, id, userId]
  );
  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const { rows } = await pool.query(
    `DELETE FROM analyses WHERE id = $1 AND user_id = $2 RETURNING pdf_url`,
    [id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (rows[0].pdf_url) {
    try {
      await del(rows[0].pdf_url);
    } catch (err) {
      console.error("Blob delete failed:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
