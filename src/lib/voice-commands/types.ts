export type VoiceCommand = {
  id: string;
  phrases: string[];
  description: string;
  category: "navigation" | "action" | "system" | "dictation";
  action: () => void | Promise<void>;
};

export interface VoiceCommandContext {
  currentPage: string;
  userRole?: string;
}

export type CommandMatchResult =
  | { matched: true; command: VoiceCommand; confidence: number }
  | { matched: false };
