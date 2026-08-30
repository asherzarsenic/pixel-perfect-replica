export type BriefSummary = {
  deliverables: string[];
  quantity: string;
  styleDirection: string;
  requirements: string[];
  deadline: string;
  platform: string;
  audience: string;
  assetsMentioned: string[];
};

export type Clarification = { item: string; whyItMatters: string; question: string };
export type Finding = { title: string; detail: string };
export type Translation = { phrase: string; couldMean: string; askThis: string };
export type BrutalNote = { problem: string; risk: string; recommendation: string };

export type BriefAnalysis = {
  projectName: string;
  summary: BriefSummary;
  clarifications: Clarification[];
  contradictions: Finding[];
  scopeRisks: Finding[];
  translations: Translation[];
  questions: string[];
  protectMessage: string;
  brutal: BrutalNote[];
};

export type BriefContext = {
  projectType?: string;
  clientName?: string;
  deadline?: string;
  budget?: string;
  audience?: string;
  deliverables?: string;
  platform?: string;
  brandGuidelines?: string;
};

export const EMPTY_ANALYSIS: BriefAnalysis = {
  projectName: "Untitled brief",
  summary: {
    deliverables: [],
    quantity: "",
    styleDirection: "",
    requirements: [],
    deadline: "",
    platform: "",
    audience: "",
    assetsMentioned: [],
  },
  clarifications: [],
  contradictions: [],
  scopeRisks: [],
  translations: [],
  questions: [],
  protectMessage: "",
  brutal: [],
};
