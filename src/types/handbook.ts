export type CodeLanguage =
  | 'cpp'
  | 'cmake'
  | 'xml'
  | 'yaml'
  | 'python'
  | 'bash'
  | 'json'
  | 'dockerfile'
  | 'ini';

export interface CodeBlockData {
  title: string;
  filename: string;
  language: CodeLanguage;
  code: string;
  sourcePath?: string;
}

export interface ComparisonTableData {
  caption: string;
  headers: string[];
  rows: string[][];
}

export type SimulatorId =
  | 'sim1'
  | 'sim2'
  | 'sim3'
  | 'sim4'
  | 'sim5'
  | 'sim6'
  | 'sim7'
  | 'sim8'
  | 'sim9'
  | 'sim10';

export interface ModuleSection {
  id: string;
  title: string;
  paragraphs: string[];
  callouts?: {
    label: string;
    text: string;
    tone: 'info' | 'warn' | 'tip';
  }[];
  table?: ComparisonTableData;
  codeBlocks?: CodeBlockData[];
  simulatorId?: SimulatorId;
}

export interface HandbookModule {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  versionScope: string;
  sections: ModuleSection[];
}

export interface InterviewQuestion {
  id: number;
  category: string;
  difficulty: '高频基础' | '进阶原理' | '架构排错';
  question: string;
  standardAnswer: string;
  bonusPoints: string;
}

export interface ChecklistWeek {
  week: number;
  title: string;
  goal: string;
  tasks: {
    id: string;
    text: string;
    deliverable: string;
  }[];
}
