export interface DisclosureRequirement {
  id: string;
  standard: string;
  standardName: string;
  paragraph: string;
  description: string;
  category: string;
  importance: "critical" | "important" | "recommended";
}

export interface ReviewInfo {
  approved: boolean;
  reviewer: string;
  reviewedAt: string;
  comment: string;
}

export interface ChecklistItem extends DisclosureRequirement {
  status: "present" | "missing" | "partial" | "not_applicable" | "unchecked";
  notes: string;
  evidence: string;
  pages: string;
  review?: ReviewInfo;
}

export interface StandardApplicability {
  standard: string;
  standardName: string;
  applicable: boolean;
  reason: string;
  requirementCount: number;
}

export interface AnalysisResult {
  framework: string;
  checklist: ChecklistItem[];
  applicability: StandardApplicability[];
  summary: {
    total: number;
    present: number;
    missing: number;
    partial: number;
    notApplicable: number;
  };
  recommendations: string[];
}

export interface Framework {
  id: string;
  name: string;
  description: string;
  standards: Standard[];
}

export interface Standard {
  id: string;
  name: string;
  requirements: DisclosureRequirement[];
}
