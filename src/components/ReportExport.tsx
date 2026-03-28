"use client";

import { AnalysisResult } from "@/types";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import { FileText } from "lucide-react";

interface ReportExportProps {
  result: AnalysisResult;
}

const statusLabel: Record<string, string> = {
  present: "Present",
  partial: "Partial",
  missing: "MISSING",
  not_applicable: "N/A",
  unchecked: "Unchecked",
};

const statusEmoji: Record<string, string> = {
  present: "[OK]",
  partial: "[PARTIAL]",
  missing: "[MISSING]",
  not_applicable: "[N/A]",
  unchecked: "[?]",
};

export default function ReportExport({ result }: ReportExportProps) {
  const exportWord = async () => {
    const { checklist, summary, recommendations, applicability } = result;

    // Group by standard
    const grouped: Record<string, typeof checklist> = {};
    for (const item of checklist) {
      if (!grouped[item.standard]) grouped[item.standard] = [];
      grouped[item.standard].push(item);
    }

    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [
          new TextRun({ text: "IFRS Disclosure Compliance Report", bold: true }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
            color: "666666",
            size: 20,
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Executive Summary
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Executive Summary" })],
      })
    );

    const complianceRate =
      summary.total > 0
        ? Math.round(
            ((summary.present + summary.notApplicable) / summary.total) * 100
          )
        : 0;

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Total requirements assessed: `, bold: true }),
          new TextRun({ text: `${summary.total}` }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Compliance rate: `, bold: true }),
          new TextRun({ text: `${complianceRate}%` }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Present: ${summary.present}  |  Partial: ${summary.partial}  |  Missing: ${summary.missing}  |  N/A: ${summary.notApplicable}` }),
        ],
        spacing: { after: 200 },
      })
    );

    // Applicability
    if (applicability && applicability.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "Standards Applicability" })],
        })
      );

      for (const a of applicability) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${a.applicable ? "[APPLICABLE]" : "[N/A]"} ${a.standard} — ${a.standardName}`,
                bold: true,
                size: 20,
              }),
            ],
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: a.reason, italics: true, color: "666666", size: 18 }),
            ],
            spacing: { after: 100 },
          })
        );
      }
    }

    // Findings by Standard
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Detailed Findings by Standard" })],
      })
    );

    for (const [standard, items] of Object.entries(grouped)) {
      const missing = items.filter((i) => i.status === "missing").length;
      const partial = items.filter((i) => i.status === "partial").length;

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: `${standard} — ${items[0].standardName}`,
            }),
          ],
        })
      );

      if (missing > 0 || partial > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${missing} missing, ${partial} partial out of ${items.length} requirements`,
                color: missing > 0 ? "CC0000" : "CC8800",
                size: 18,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      for (const item of items) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${statusEmoji[item.status]} `,
                bold: true,
                color:
                  item.status === "present"
                    ? "008800"
                    : item.status === "missing"
                      ? "CC0000"
                      : item.status === "partial"
                        ? "CC8800"
                        : "999999",
              }),
              new TextRun({
                text: `${item.paragraph}`,
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: item.pages && item.pages !== "N/A" ? `  (p. ${item.pages})` : "",
                color: "0066CC",
                size: 18,
              }),
              new TextRun({
                text: `  [${item.importance}]`,
                color: "999999",
                size: 16,
              }),
            ],
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: item.description, size: 20 }),
            ],
            indent: { left: 360 },
          })
        );
        if (item.notes) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Assessment: ${item.notes}`,
                  italics: true,
                  color: "444444",
                  size: 18,
                }),
              ],
              indent: { left: 360 },
            })
          );
        }
        if (item.evidence) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Evidence: "${item.evidence}"`,
                  italics: true,
                  color: "666666",
                  size: 16,
                }),
              ],
              indent: { left: 360 },
              spacing: { after: 100 },
            })
          );
        } else {
          children.push(
            new Paragraph({
              children: [],
              spacing: { after: 80 },
            })
          );
        }
      }
    }

    // Recommendations
    if (recommendations.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "Recommendations" })],
        })
      );
      for (let i = 0; i < recommendations.length; i++) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${i + 1}. ${recommendations[i]}`,
                size: 20,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }
    }

    // Disclaimer
    children.push(
      new Paragraph({
        children: [],
        spacing: { before: 400 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Disclaimer: This report was generated using AI-powered analysis. All findings should be reviewed and verified by a qualified auditor before reliance.",
            italics: true,
            color: "999999",
            size: 16,
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `disclosure-report-${new Date().toISOString().slice(0, 10)}.docx`);
  };

  const exportHtml = () => {
    const { checklist, summary, recommendations, applicability } = result;
    const complianceRate =
      summary.total > 0
        ? Math.round(
            ((summary.present + summary.notApplicable) / summary.total) * 100
          )
        : 0;

    const grouped: Record<string, typeof checklist> = {};
    for (const item of checklist) {
      if (!grouped[item.standard]) grouped[item.standard] = [];
      grouped[item.standard].push(item);
    }

    const statusColor: Record<string, string> = {
      present: "#16a34a",
      partial: "#d97706",
      missing: "#dc2626",
      not_applicable: "#9ca3af",
      unchecked: "#9ca3af",
    };

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Disclosure Compliance Report</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#1f2937;line-height:1.6}
h1{color:#1e40af;border-bottom:2px solid #dbeafe;padding-bottom:8px}
h2{color:#374151;margin-top:32px}
.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:20px 0}
.card{padding:16px;border-radius:8px;text-align:center;border:1px solid #e5e7eb}
.card h3{font-size:24px;margin:0}.card p{font-size:12px;margin:4px 0 0;color:#6b7280}
.bar{height:12px;border-radius:6px;background:#e5e7eb;margin:16px 0}
.bar-fill{height:100%;border-radius:6px}
.item{padding:8px 0;border-bottom:1px solid #f3f4f6}
.status{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:white}
.page{color:#2563eb;font-size:12px;font-weight:500}
.notes{font-style:italic;color:#6b7280;font-size:13px;margin-top:4px}
.evidence{background:#f9fafb;padding:8px;border-radius:4px;font-size:12px;color:#6b7280;margin-top:4px}
.applicable{display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px}
@media print{body{margin:20px}}
</style></head><body>
<h1>IFRS Disclosure Compliance Report</h1>
<p style="color:#6b7280">Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

<h2>Executive Summary</h2>
<div class="summary">
<div class="card"><h3>${summary.total}</h3><p>Total</p></div>
<div class="card" style="background:#f0fdf4;border-color:#bbf7d0"><h3 style="color:#16a34a">${summary.present}</h3><p>Present</p></div>
<div class="card" style="background:#fef2f2;border-color:#fecaca"><h3 style="color:#dc2626">${summary.missing}</h3><p>Missing</p></div>
<div class="card" style="background:#fffbeb;border-color:#fde68a"><h3 style="color:#d97706">${summary.partial}</h3><p>Partial</p></div>
<div class="card"><h3 style="color:#6b7280">${summary.notApplicable}</h3><p>N/A</p></div>
</div>
<div class="bar"><div class="bar-fill" style="width:${complianceRate}%;background:${complianceRate >= 80 ? "#16a34a" : complianceRate >= 50 ? "#d97706" : "#dc2626"}"></div></div>
<p><strong>Compliance Rate: ${complianceRate}%</strong></p>`;

    if (applicability && applicability.length > 0) {
      html += `<h2>Standards Applicability</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="background:#f9fafb"><th style="text-align:left;padding:6px;border:1px solid #e5e7eb">Standard</th><th style="text-align:left;padding:6px;border:1px solid #e5e7eb">Status</th><th style="text-align:left;padding:6px;border:1px solid #e5e7eb">Reason</th><th style="text-align:center;padding:6px;border:1px solid #e5e7eb">Items</th></tr>`;
      for (const a of applicability) {
        html += `<tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>${a.standard}</strong> ${a.standardName}</td><td style="padding:6px;border:1px solid #e5e7eb"><span class="applicable" style="background:${a.applicable ? "#dcfce7;color:#166534" : "#f3f4f6;color:#6b7280"}">${a.applicable ? "Applicable" : "N/A"}</span></td><td style="padding:6px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280">${a.reason}</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:center">${a.requirementCount}</td></tr>`;
      }
      html += `</table>`;
    }

    html += `<h2>Detailed Findings</h2>`;
    for (const [standard, items] of Object.entries(grouped)) {
      html += `<h3>${standard} — ${items[0].standardName}</h3>`;
      for (const item of items) {
        html += `<div class="item">
<span class="status" style="background:${statusColor[item.status]}">${statusLabel[item.status]}</span>
<strong> ${item.paragraph}</strong>
${item.pages && item.pages !== "N/A" ? `<span class="page"> p. ${item.pages}</span>` : ""}
<span style="font-size:11px;color:#9ca3af"> [${item.importance}]</span>
<br><span style="font-size:13px">${item.description}</span>
${item.notes ? `<div class="notes">Assessment: ${item.notes}</div>` : ""}
${item.evidence ? `<div class="evidence">"${item.evidence}"</div>` : ""}
</div>`;
      }
    }

    if (recommendations.length > 0) {
      html += `<h2>Recommendations</h2><ol style="font-size:13px">`;
      for (const rec of recommendations) {
        html += `<li style="margin-bottom:8px">${rec}</li>`;
      }
      html += `</ol>`;
    }

    html += `<hr style="margin-top:40px;border:none;border-top:1px solid #e5e7eb"><p style="font-size:11px;color:#9ca3af;font-style:italic">This report was generated using AI-powered analysis. All findings should be reviewed by a qualified auditor.</p></body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      // Allow printing
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={exportWord}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        Export Word
      </button>
      <button
        onClick={exportHtml}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        Print Report
      </button>
    </div>
  );
}
