import Anthropic from "@anthropic-ai/sdk";
import { DisclosureRequirement, ChecklistItem } from "@/types";

const client = new Anthropic();

const BATCH_SIZE = 60;
const MAX_PARALLEL = 10;

type AnalysisItem = { id: string; status: string; pages: string; notes: string; evidence: string };

// ─── Pass 1: Fast relevance scan ────────────────────────────────
async function identifyRelevantStandards(
  text: string,
  standards: string[]
): Promise<{ relevant: string[]; notApplicable: string[] }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an IFRS expert. Quickly scan this financial statement and determine which IFRS/IAS standards are RELEVANT (the entity has these types of transactions/balances) vs NOT APPLICABLE (the entity clearly does not have these).

Standards to assess:
${standards.join(", ")}

Scan the document for: balance sheet line items, note headings, accounting policy descriptions, and any mentions of specific topics (leases, insurance, share-based payments, business combinations, etc.)

=== FINANCIAL STATEMENT TEXT (first 30,000 chars) ===
${text.substring(0, 30000)}

Return JSON:
{
  "relevant": ["IAS 1", "IAS 2", ...],
  "not_applicable": ["IFRS 17", ...]
}

Be INCLUSIVE — if unsure, mark as relevant. Only mark not_applicable when you are confident the entity does not have those items (e.g., no insurance contracts = IFRS 17 N/A; no mention of share-based payments = IFRS 2 N/A).

Return ONLY the JSON.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  // Extract JSON object if wrapped in prose
  const objMatch = jsonText.match(/\{[\s\S]*\}/);
  if (objMatch) jsonText = objMatch[0];

  try {
    const result = JSON.parse(jsonText);
    return {
      relevant: result.relevant || standards,
      notApplicable: result.not_applicable || [],
    };
  } catch {
    // If parsing fails, assume all standards are relevant
    return { relevant: standards, notApplicable: [] };
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
): Promise<ChecklistItem[]> {
  const truncatedText = text.substring(0, 180000);

  // Pass 1: Identify which standards are relevant (fast, ~2-3 seconds)
  const uniqueStandards = [...new Set(requirements.map((r) => r.standard))];
  const { notApplicable } = await identifyRelevantStandards(
    truncatedText,
    uniqueStandards
  );

  // Split requirements: relevant ones get analyzed, N/A ones get auto-marked
  const relevantReqs = requirements.filter(
    (r) => !notApplicable.includes(r.standard)
  );
  const naReqs = requirements.filter((r) =>
    notApplicable.includes(r.standard)
  );

  // Pass 2: Analyze relevant requirements in parallel batches
  const batches: DisclosureRequirement[][] = [];
  for (let i = 0; i < relevantReqs.length; i += BATCH_SIZE) {
    batches.push(relevantReqs.slice(i, i + BATCH_SIZE));
  }

  // All batches in parallel (up to MAX_PARALLEL)
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
  return requirements.map((req) => {
    // Auto-mark N/A standards
    if (notApplicable.includes(req.standard)) {
      return {
        ...req,
        status: "not_applicable" as const,
        pages: "N/A",
        notes: `Standard ${req.standard} not applicable — entity does not appear to have these types of transactions/balances.`,
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
}
