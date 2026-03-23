import Anthropic from "@anthropic-ai/sdk";
import { DisclosureRequirement, ChecklistItem } from "@/types";

const client = new Anthropic();

const BATCH_SIZE = 30;

function buildPrompt(text: string, requirements: DisclosureRequirement[]): string {
  const requirementsList = requirements
    .map(
      (r) =>
        `[${r.id}] ${r.standard} ${r.paragraph}: ${r.description} (${r.importance})`
    )
    .join("\n");

  return `You are a senior IFRS audit expert performing a disclosure compliance review. You must carefully analyze the financial statements below against each disclosure requirement.

The financial statement text is annotated with [PAGE X] markers at the start of each page.

CRITICAL INSTRUCTIONS — READ CAREFULLY:

1. SEARCH THOROUGHLY: Disclosures can appear ANYWHERE in the document — in notes, on the face of statements, in accounting policy sections, in risk management sections, in supplementary information, or in management commentary. Do NOT mark something as "missing" just because it's not in the obvious place.

2. ACCEPT EQUIVALENT WORDING: Financial statements use varied terminology. A disclosure requirement may be satisfied by different wording. For example:
   - "Going concern" may appear as "ability to continue as a going concern", "continuity of operations", or similar
   - "Measurement basis" may appear as "valuation method", "basis of measurement", "carried at cost/fair value"
   - Revenue disaggregation may appear in segment notes, product line tables, or geographic breakdowns
   - Related party disclosures may appear under "transactions with related parties", "key management", "directors' remuneration"

3. CONSIDER IMPLICIT DISCLOSURES: Some requirements are satisfied implicitly. For example:
   - If financial statements show current/non-current classification on the balance sheet, that requirement is "present" even without a separate note
   - If an expense analysis by function is shown on the income statement face, it satisfies IAS 1.97
   - If comparative figures are shown alongside current period, comparative information requirements are met

4. USE "not_applicable" CORRECTLY: Mark as N/A only when the entity clearly does not have the relevant items (e.g., no goodwill = goodwill impairment testing is N/A; no leases = IFRS 16 is N/A). Do NOT mark as N/A just because you cannot find the disclosure.

5. BIAS TOWARD "present" or "partial" OVER "missing": Only mark "missing" when you are confident the disclosure is truly absent after searching the ENTIRE document. If there is ANY relevant information, even if incomplete, mark as "partial".

6. STATUS DEFINITIONS:
   - "present" — the disclosure requirement is adequately addressed (does not need to be perfect)
   - "partial" — some relevant information exists but is clearly incomplete or lacks required detail
   - "missing" — you have searched the entire document and are confident this required disclosure is completely absent
   - "not_applicable" — the entity does not have the type of transaction/balance/arrangement this requirement relates to

For each requirement provide:
- "pages" — exact page number(s) where found (e.g. "42", "42-44", "15, 67"). Use "N/A" only if truly missing or not applicable.
- "notes" — brief explanation of your assessment. If "present", note WHERE you found it. If "missing", explain what you looked for and why you believe it's absent.
- "evidence" — quote the specific text that satisfies (or partially satisfies) the requirement. Empty string only if truly missing.

=== FINANCIAL STATEMENT TEXT ===
${text}

=== DISCLOSURE REQUIREMENTS ===
${requirementsList}

Return a JSON array of objects with this exact structure:
[
  {
    "id": "requirement_id",
    "status": "present|partial|missing|not_applicable",
    "pages": "page number(s) or N/A",
    "notes": "explanation",
    "evidence": "quoted text or reference"
  }
]

Return ONLY the JSON array, no other text.`;
}

async function analyzeBatch(
  text: string,
  requirements: DisclosureRequirement[]
): Promise<Array<{ id: string; status: string; pages: string; notes: string; evidence: string }>> {
  const prompt = buildPrompt(text, requirements);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(jsonText);
}

export async function analyzeFinancialStatements(
  text: string,
  requirements: DisclosureRequirement[]
): Promise<ChecklistItem[]> {
  // Send full text (up to 180k chars to fit context)
  const truncatedText = text.substring(0, 180000);

  // Split requirements into batches for better accuracy
  const batches: DisclosureRequirement[][] = [];
  for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
    batches.push(requirements.slice(i, i + BATCH_SIZE));
  }

  // Process batches concurrently (max 3 parallel)
  const allResults: Array<{ id: string; status: string; pages: string; notes: string; evidence: string }> = [];

  for (let i = 0; i < batches.length; i += 3) {
    const chunk = batches.slice(i, i + 3);
    const batchResults = await Promise.all(
      chunk.map((batch) => analyzeBatch(truncatedText, batch))
    );
    for (const results of batchResults) {
      allResults.push(...results);
    }
  }

  // Merge analysis results with requirement metadata
  return requirements.map((req) => {
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
