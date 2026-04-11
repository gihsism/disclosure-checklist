import Anthropic from "@anthropic-ai/sdk";
import { ScopingResult } from "@/types/scoping";
import { hashRequest, getCached, setCached } from "./llm-cache";

const client = new Anthropic();

export async function runScopingAnalysis(text: string): Promise<ScopingResult> {
  const prompt = `You are a senior IFRS auditor performing a scoping analysis of financial statements before a disclosure compliance review.

Analyze the financial statements below and provide a comprehensive scoping assessment.

=== FINANCIAL STATEMENT TEXT (first 50,000 chars) ===
${text.substring(0, 50000)}

Return a JSON object with this exact structure:
{
  "entity": {
    "name": "Company name",
    "type": "Listed public company / Private company / Financial institution / Insurance company / Investment fund / Government entity / Other",
    "industry": "Industry sector",
    "country": "Country of incorporation/domicile",
    "reportingPeriod": "e.g. Year ended 31 December 2025",
    "presentationCurrency": "e.g. CHF / USD / EUR",
    "auditor": "Audit firm name if mentioned",
    "framework": "e.g. IFRS as issued by the IASB / IFRS as adopted by the EU"
  },
  "keyFigures": {
    "totalAssets": "Amount with currency",
    "totalRevenue": "Amount with currency",
    "netIncome": "Amount with currency (or net loss)",
    "totalEquity": "Amount with currency",
    "employees": "Number if disclosed"
  },
  "significantAreas": [
    {
      "area": "e.g. Revenue from construction contracts",
      "description": "Brief description of why this is significant",
      "relevantStandards": ["IFRS 15", "IAS 37"]
    }
  ],
  "riskAreas": [
    "e.g. Goodwill impairment testing — large goodwill balance relative to equity",
    "e.g. Expected credit losses — significant loan portfolio",
    "e.g. Lease accounting — extensive property leases"
  ],
  "applicableStandards": [
    { "standard": "IAS 1", "reason": "Required for all IFRS reporters" }
  ],
  "notApplicableStandards": [
    { "standard": "IFRS 17", "reason": "No insurance contracts identified" }
  ],
  "summary": "2-3 sentence summary of the entity and key audit/disclosure focus areas"
}

IMPORTANT:
- For significantAreas, identify 5-10 key areas based on materiality and complexity
- For riskAreas, identify 3-7 areas where disclosure deficiencies are most likely
- Be thorough in assessing which of the 32 IFRS/IAS standards apply
- Include ALL of: IAS 1,2,7,8,10,12,16,19,21,23,24,27,28,32,33,34,36,37,38,40 and IFRS 2,3,5,7,8,9,10,12,13,15,16,17 in either applicable or not applicable
- If unsure, include in applicable

Return ONLY the JSON.`;

  const hash = hashRequest({
    model: "claude-sonnet-4-20250514",
    system: "You are a senior IFRS auditor. Respond with ONLY valid JSON.",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 6000,
  });

  const cached = getCached(hash);
  let responseText: string;

  if (cached) {
    responseText = cached;
  } else {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: "You are a senior IFRS auditor. Respond with ONLY valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");
    responseText = content.text;
    setCached(hash, responseText);
  }

  let jsonText = responseText.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const objMatch = jsonText.match(/\{[\s\S]*\}/);
  if (objMatch) jsonText = objMatch[0];

  return JSON.parse(jsonText);
}
