export interface ScopingReview {
  approved: boolean;
  reviewer: string;
  reviewedAt: string;
  comment: string;
}

export interface ScopingResult {
  review?: ScopingReview;
  entity: {
    name: string;
    type: string; // e.g. "Listed public company", "Private company", "Financial institution"
    industry: string;
    country: string;
    reportingPeriod: string;
    presentationCurrency: string;
    auditor: string;
    framework: string; // e.g. "IFRS as issued by the IASB"
  };
  keyFigures: {
    totalAssets: string;
    totalRevenue: string;
    netIncome: string;
    totalEquity: string;
    employees: string;
  };
  significantAreas: Array<{
    area: string;
    description: string;
    relevantStandards: string[];
  }>;
  riskAreas: string[];
  applicableStandards: Array<{
    standard: string;
    reason: string;
  }>;
  notApplicableStandards: Array<{
    standard: string;
    reason: string;
  }>;
  summary: string;
}
