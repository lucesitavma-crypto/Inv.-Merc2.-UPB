export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: string;
  programName: string;
  markdown: string;
  driveNotice?: string | null;
  grounding?: {
    searchQueries: string[];
    sources: GroundingSource[];
  };
}

export interface CompetitorComparisonRow {
  variable: string;
  upb: string;
  competitor1: string;
  competitor2: string;
}
