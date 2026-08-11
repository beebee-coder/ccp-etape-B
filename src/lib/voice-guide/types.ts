export type FieldType = "text" | "textarea" | "email" | "password" | "number" | "select" | "checkbox" | "file" | "date";

export interface FieldDescriptor {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  validation?: string;
  element?: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

export interface FormDescriptor {
  id: string;
  name: string;
  fields: FieldDescriptor[];
  submitLabel?: string;
}

export type GuidePhase = "idle" | "listening" | "speaking" | "processing" | "confirming";

export interface VoiceGuideState {
  active: boolean;
  phase: GuidePhase;
  currentFieldIndex: number;
  form: FormDescriptor | null;
  transcript: string;
  guidance: string;
  error: string | null;
  isListening: boolean;
  isSpeaking: boolean;
  filledValues: Record<string, string>;
}

export type VoiceGuideAction =
  | { type: "ACTIVATE" }
  | { type: "DEACTIVATE" }
  | { type: "SET_FORM"; form: FormDescriptor }
  | { type: "NEXT_FIELD" }
  | { type: "PREV_FIELD" }
  | { type: "SET_TRANSCRIPT"; transcript: string }
  | { type: "SET_GUIDANCE"; guidance: string }
  | { type: "SET_PHASE"; phase: GuidePhase }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_LISTENING"; isListening: boolean }
  | { type: "SET_SPEAKING"; isSpeaking: boolean }
  | { type: "UPDATE_FIELD_VALUE"; fieldId: string; value: string }
  | { type: "RESET" };
