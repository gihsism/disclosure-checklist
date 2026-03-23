import Anthropic from "@anthropic-ai/sdk";
import { DisclosureRequirement, ChecklistItem } from "@/types";

const client = new Anthropic();

export async function analyzeFinancialStatements(
  text: string,
  requirements: DisclosureRequirement[]
): Promise<ChecklistItem[]> {
  const requirementsList = requirements
    .map(
      (r) =>
        `[${r.id}] ${r.standard} ${r.paragraph}: ${r.description} (${r.importance})`
    )
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: `You are an expert auditor reviewing financial statements for IFRS disclosure compliance. Analyze the following financial statement text against each disclosure requirement listed below.

For each requirement, determine its status:
- "present" — the disclosure is adequately made
- "partial" — some disclosure exists but is incomplete
- "missing" — the disclosure is required but absent
- "not_applicable" — the requirement does not apply to this entity based on the financial statements

Also provide:
- "notes" — a brief explanation of your assessment
- "evidence" — quote or reference the specific text from the financial statements that supports your assessment (empty string if missing)

IMPORTANT: Be thorough and precise. Reference specific paragraphs and numbers from the financial statements.

=== FINANCIAL STATEMENT TEXT ===
${text.substring(0, 100000)}

=== DISCLOSURE REQUIREMENTS ===
${requirementsList}

Return a JSON array of objects with this exact structure:
[
  {
    "id": "requirement_id",
    "status": "present|partial|missing|not_applicable",
    "notes": "explanation",
    "evidence": "quoted text or reference"
  }
]

Return ONLY the JSON array, no other text.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  let analysisResults: Array<{
    id: string;
    status: string;
    notes: string;
    evidence: string;
  }>;

  try {
    // Try to parse the response, handling potential markdown code blocks
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    analysisResults = JSON.parse(jsonText);
  } catch {
    throw new Error("Failed to parse AI analysis response");
  }

  // Merge analysis results with requirement metadata
  return requirements.map((req) => {
    const result = analysisResults.find((r) => r.id === req.id);
    return {
      ...req,
      status: (result?.status as ChecklistItem["status"]) || "unchecked",
      notes: result?.notes || "",
      evidence: result?.evidence || "",
    };
  });
}
