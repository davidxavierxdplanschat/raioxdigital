export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type CheckOwner = "SEO" | "Frontend" | "Backend";
export type CheckImpact = "alto" | "médio" | "baixo";

export type ScanCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
  value?: string;
  owner: CheckOwner;
  impact: CheckImpact;
};

export type LighthouseMetric = {
  label: string;
  value: string;
  score: number | null;
};

export type PageSpeedData = {
  available: boolean;
  source: "Google PageSpeed Insights" | "auditoria própria";
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  metrics: LighthouseMetric[];
  note?: string;
};

export type ScanResult = {
  requestedUrl: string;
  finalUrl: string;
  scannedAt: string;
  statusCode: number;
  responseTimeMs: number;
  htmlSizeKb: number;
  title: string | null;
  overallScore: number;
  grade: "EXCELENTE" | "BOM" | "ATENÇÃO" | "CRÍTICO";
  scores: {
    seo: number;
    performance: number;
    responsive: number;
    technical: number;
  };
  counts: {
    headings: number;
    images: number;
    imagesWithoutAlt: number;
    links: number;
    structuredData: number;
  };
  pageSpeed: PageSpeedData;
  checks: ScanCheck[];
  summary: string;
};

export type ScanApiResponse =
  | { ok: true; result: ScanResult }
  | { ok: false; error: string; code?: string };
