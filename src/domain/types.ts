export type PlanKind = "learning" | "task";
export type EntryKind = "new" | "review" | "remedial" | "task";
export type ReviewFeedback = "remembered" | "fuzzy" | "forgotten" | "skipped";

export type PlanThemeId = "ink" | "madder" | "clay" | "amber" | "sage" | "pine" | "teal" | "lake" | "plum" | "rose";
export type BuiltInAppearanceThemeId = "graphite" | "carbon" | "teaCream" | "frostGray";
export type AppearanceThemeId = BuiltInAppearanceThemeId | string;
export type StartupView = "today" | "month" | "plans" | "notebook" | "progress";
export type CloseBehavior = "quit" | "tray";

export interface Plan {
  id: string;
  name: string;
  kind: PlanKind;
  themeId: PlanThemeId;
  startDate: string;
  dayCount: number;
  reviewOffsets: number[];
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  planId: string;
  title: string;
  tags?: string[];
  noteMarkdown: string;
  firstDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEntry {
  id: string;
  planId: string;
  knowledgeId: string;
  stepIndex?: number;
  date: string;
  kind: EntryKind;
  completed: boolean;
  completedDate?: string;
  completedAt?: string;
  feedback?: ReviewFeedback;
  originalDate?: string;
  postponedAt?: string;
  deferredUntil?: string;
  adaptiveSourceEntryId?: string;
  adaptiveFeedback?: ReviewFeedback;
  createdAt: string;
}

export interface AppData {
  schemaVersion: number;
  plans: Plan[];
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  activePlanId: string | null;
  appearanceThemeId: AppearanceThemeId;
  customAppearanceThemes: AppearanceTheme[];
  startupView: StartupView;
  launchAtLogin: boolean;
  closeBehavior: CloseBehavior;
  cloudSync?: CloudSyncConfig;
  lastSyncTime?: string;
}

export interface CreatePlanInput {
  name: string;
  kind: PlanKind;
  themeId: PlanThemeId;
  startDate: string;
  dayCount: number;
  reviewOffsets: number[];
}

export interface UpdatePlanInput {
  name: string;
  kind: PlanKind;
  themeId: PlanThemeId;
  startDate: string;
  dayCount: number;
  reviewOffsets: number[];
}

export interface CreateKnowledgeInput {
  plan: Plan;
  title: string;
  date: string;
}

export interface PlanTheme {
  id: PlanThemeId;
  name: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  ink: string;
}

export interface AppearanceTheme {
  id: AppearanceThemeId;
  name: string;
  description: string;
  titleFont: string;
  bodyFont: string;
  paper: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  weak: string;
}

export interface CloudSyncConfig {
  url: string;
  username: string;
  password: string;
}

export interface CloudSyncDiff {
  newPlans: string[];
  deletedPlans: string[];
  modifiedPlans: string[];
  newKnowledge: string[];
  deletedKnowledge: string[];
  modifiedKnowledge: string[];
  modifiedNotes: string[];
  modifiedCompletion: string[];
}
