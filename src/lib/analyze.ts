import Anthropic from "@anthropic-ai/sdk";
import { DisclosureRequirement, ChecklistItem, StandardApplicability } from "@/types";

const client = new Anthropic();

const BATCH_SIZE = 60;
const MAX_PARALLEL = 10;

type AnalysisItem = { id: string; status: string; pages: string; notes: string; evidence: string };

// ─── Pass 1: Fast applicability assessment ──────────────────────
interface ApplicabilityResult {
  relevant: string[];
  notApplicable: string[];
  assessments: Record<string, { applicable: boolean; reason: string }>;
}

async function assessApplicability(
  text: string,
  standards: string[]
): Promise<ApplicabilityResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: "You are an IFRS expert. Respond with ONLY valid JSON, no other text.",
    messages: [
      {
        role: "user",
        content: `Scan the financial statements below and assess which IFRS/IAS standards are applicable to this entity.

For each standard, determine:
- Whether it is applicable (the entity has these types of transactions/balances/arrangements)
- A brief reason explaining why it is or isn't applicable (e.g. "Entity has property, plant and equipment on balance sheet" or "No insurance contracts identified")

Standards to assess:
${standards.join(", ")}

Look at: balance sheet line items, note headings, accounting policy descriptions, industry context, and mentions of specific topics.

=== FINANCIAL STATEMENT TEXT (first 40,000 chars) ===
${text.substring(0, 40000)}

Return JSON:
{
  "assessments": {
    "IAS 1": { "applicable": true, "reason": "Required for all entities presenting IFRS financial statements" },
    "IFRS 17": { "applicable": false, "reason": "No insurance contracts or reinsurance arrangements identified" },
    ...
  }
}

Be INCLUSIVE — if unsure, mark as applicable. Only mark not applicable when you are confident.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const objMatch = jsonText.match(/\{[\s\S]*\}/);
  if (objMatch) jsonText = objMatch[0];

  try {
    const result = JSON.parse(jsonText);
    const assessments: Record<string, { applicable: boolean; reason: string }> = result.assessments || {};

    const relevant: string[] = [];
    const notApplicable: string[] = [];

    for (const std of standards) {
      const assessment = assessments[std];
      if (assessment && !assessment.applicable) {
        notApplicable.push(std);
      } else {
        relevant.push(std);
      }
    }

    return { relevant, notApplicable, assessments };
  } catch {
    // If parsing fails, assume all standards are relevant
    const assessments: Record<string, { applicable: boolean; reason: string }> = {};
    for (const std of standards) {
      assessments[std] = { applicable: true, reason: "Could not determine — included for review" };
    }
    return { relevant: standards, notApplicable: [], assessments };
  }
}

// ─── Pass 2: Detailed analysis ──────────────────────────────────
function buildPrompt(text: string, requirements: DisclosureRequirement[]): string {
  const requirementsList = requirements
    .map(
      (r) =>
        `[${r.id}] ${r.standard} ${r.paragraph}: ${r.description} (${r.importance})`
    )
    .join("\n");

  return `You are a senior IFRS audit expert. Analyze the financial statements against each disclosure requirement below.

The text has [PAGE X] markers at the start of each page.

RULES:
1. Search the ENTIRE document — disclosures can be anywhere (notes, face of statements, policies, risk sections).
2. Accept equivalent wording and implicit disclosures (e.g., current/non-current shown on balance sheet = present).
3. Only mark "missing" when you are CONFIDENT after full search. If any relevant info exists, mark "partial".
4. Mark "not_applicable" only when entity clearly lacks the item type.

For each requirement:
- "status": "present" | "partial" | "missing" | "not_applicable"
- "pages": page number(s) from [PAGE X] markers (e.g. "42", "15, 67"). "N/A" if missing/not applicable.
- "notes": brief explanation (where found if present, what's missing if partial/missing)
- "evidence": quoted text (empty string if missing)

=== FINANCIAL STATEMENT TEXT ===
${text}

=== REQUIREMENTS ===
${requirementsList}

Return ONLY a JSON array:
[{"id":"...","status":"...","pages":"...","notes":"...","evidence":"..."}]`;
}

async function analyzeBatch(
  text: string,
  requirements: DisclosureRequirement[]
): Promise<AnalysisItem[]> {
  const prompt = buildPrompt(text, requirements);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: "You are an IFRS disclosure compliance analyzer. You MUST respond with ONLY a valid JSON array. No explanations, no markdown, no prose — just the JSON array starting with [ and ending with ].",
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let jsonText = content.text.trim();
  // Strip markdown code blocks
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  // Extract JSON array if wrapped in prose
  const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonText = arrayMatch[0];
  }
  try {
    return JSON.parse(jsonText);
  } catch {
    // If still can't parse, return defaults for all requirements
    console.error("Failed to parse AI response, returning defaults. Response start:", jsonText.substring(0, 200));
    return requirements.map((r) => ({
      id: r.id,
      status: "unchecked",
      pages: "N/A",
      notes: "Analysis could not be completed for this item — please review manually.",
      evidence: "",
    }));
  }
}

export async function analyzeFinancialStatements(
  text: string,
  requirements: DisclosureRequirement[]
): Promise<{ checklist: ChecklistItem[]; applicability: StandardApplicability[] }> {
  const truncatedText = text.substring(0, 180000);

  // Pass 1: Assess applicability of each standard
  const uniqueStandards = [...new Set(requirements.map((r) => r.standard))];
  const standardNames: Record<string, string> = {};
  const standardCounts: Record<string, number> = {};
  for (const req of requirements) {
    standardNames[req.standard] = req.standardName;
    standardCounts[req.standard] = (standardCounts[req.standard] || 0) + 1;
  }

  const { notApplicable, assessments } = await assessApplicability(
    truncatedText,
    uniqueStandards
  );

  // Build applicability report
  const applicability: StandardApplicability[] = uniqueStandards.map((std) => {
    const assessment = assessments[std];
    return {
      standard: std,
      standardName: standardNames[std] || std,
      applicable: !notApplicable.includes(std),
      reason: assessment?.reason || (notApplicable.includes(std) ? "Not applicable to this entity" : "Applicable"),
      requirementCount: standardCounts[std] || 0,
    };
  });

  // Split requirements: relevant ones get analyzed, N/A ones get auto-marked
  const relevantReqs = requirements.filter(
    (r) => !notApplicable.includes(r.standard)
  );

  // Pass 2: Analyze relevant requirements in parallel batches
  const batches: DisclosureRequirement[][] = [];
  for (let i = 0; i < relevantReqs.length; i += BATCH_SIZE) {
    batches.push(relevantReqs.slice(i, i + BATCH_SIZE));
  }

  const allResults: AnalysisItem[] = [];
  for (let i = 0; i < batches.length; i += MAX_PARALLEL) {
    const chunk = batches.slice(i, i + MAX_PARALLEL);
    const batchResults = await Promise.all(
      chunk.map((batch) => analyzeBatch(truncatedText, batch))
    );
    for (const results of batchResults) {
      allResults.push(...results);
    }
  }

  // Merge results
  const checklist = requirements.map((req) => {
    if (notApplicable.includes(req.standard)) {
      const assessment = assessments[req.standard];
      return {
        ...req,
        status: "not_applicable" as const,
        pages: "N/A",
        notes: assessment?.reason || `Standard ${req.standard} not applicable to this entity.`,
        evidence: "",
      };
    }

    const result = allResults.find((r) => r.id === req.id);
    return {
      ...req,
      status: (result?.status as ChecklistItem["status"]) || "unchecked",
      pages: result?.pages || "N/A",
      notes: result?.notes || "",
      evidence: result?.evidence || "",
    };
  });

  return { checklist, applicability };
}
