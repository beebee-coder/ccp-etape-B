"use client";

import { useCallback, useEffect, useReducer } from "react";
import { useSpeech } from "@/lib/speech/use-speech";
import {
  detectFormFields,
  fillField,
  focusField,
} from "./form-analyzer";
import { generateFieldGuidance, generateTransitionGuidance, generateCompletionMessage } from "./advisor";
import type { FieldDescriptor, FormDescriptor, VoiceGuideAction, VoiceGuideState } from "./types";

function voiceGuideReducer(state: VoiceGuideState, action: VoiceGuideAction): VoiceGuideState {
  switch (action.type) {
    case "ACTIVATE":
      return { ...state, active: true };
    case "DEACTIVATE":
      return { ...state, active: false, phase: "idle" };
    case "SET_FORM":
      return { ...state, form: action.form, currentFieldIndex: 0 };
    case "NEXT_FIELD":
      if (!state.form || state.currentFieldIndex >= state.form.fields.length - 1) return state;
      return { ...state, currentFieldIndex: state.currentFieldIndex + 1 };
    case "PREV_FIELD":
      if (!state.form || state.currentFieldIndex <= 0) return state;
      return { ...state, currentFieldIndex: state.currentFieldIndex - 1 };
    case "SET_TRANSCRIPT":
      return { ...state, transcript: action.transcript };
    case "SET_GUIDANCE":
      return { ...state, guidance: action.guidance };
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_LISTENING":
      return { ...state, isListening: action.isListening };
    case "SET_SPEAKING":
      return { ...state, isSpeaking: action.isSpeaking };
    case "UPDATE_FIELD_VALUE":
      return {
        ...state,
        filledValues: { ...state.filledValues, [action.fieldId]: action.value },
      };
    case "RESET":
      return {
        active: false,
        phase: "idle",
        currentFieldIndex: 0,
        form: null,
        transcript: "",
        guidance: "",
        error: null,
        isListening: false,
        isSpeaking: false,
        filledValues: {},
      };
    default:
      return state;
  }
}

const initialState: VoiceGuideState = {
  active: false,
  phase: "idle",
  currentFieldIndex: 0,
  form: null,
  transcript: "",
  guidance: "",
  error: null,
  isListening: false,
  isSpeaking: false,
  filledValues: {},
};

export function useVoiceGuide() {
  const [state, dispatch] = useReducer(voiceGuideReducer, initialState);
  const { speak, stopSpeaking, isListening, transcript, error: speechError, startListening, stopListening, toggleListening } =
    useSpeech({ language: "fr-FR", continuous: false });

  useEffect(() => {
    if (transcript) {
      dispatch({ type: "SET_TRANSCRIPT", transcript });
    }
  }, [transcript]);

  useEffect(() => {
    if (speechError) {
      dispatch({ type: "SET_ERROR", error: speechError });
    }
  }, [speechError]);

  const activate = useCallback(async () => {
    dispatch({ type: "ACTIVATE" });
    await startListening();
  }, [startListening]);

  const deactivate = useCallback(() => {
    stopListening();
    stopSpeaking();
    dispatch({ type: "DEACTIVATE" });
  }, [stopListening, stopSpeaking]);

  const analyzeCurrentForm = useCallback((): FormDescriptor | null => {
    const detected = detectFormFields();
    if (detected.fields.length === 0) return null;

    const fields: FieldDescriptor[] = detected.fields.map((f) => ({
      id: f.id,
      name: f.name,
      label: f.label,
      type: f.type as FieldDescriptor["type"],
      placeholder: f.placeholder,
      required: f.required,
    }));

    const formName = extractPageName();
    return {
      id: `auto-${Date.now()}`,
      name: formName,
      fields,
      submitLabel: detected.submitButton?.textContent?.trim() || "Envoyer",
    };
  }, []);

  const startGuidance = useCallback(async () => {
    const form = analyzeCurrentForm();
    if (!form || form.fields.length === 0) {
      dispatch({ type: "SET_ERROR", error: "Aucun champ de formulaire détecté sur cette page." });
      return;
    }

    dispatch({ type: "SET_FORM", form });
    dispatch({ type: "SET_PHASE", phase: "processing" });

    const firstField = form.fields[0];
    const guidance = await generateFieldGuidance({
      fieldLabel: firstField.label,
      fieldType: firstField.type,
      placeholder: firstField.placeholder,
      required: firstField.required,
      formContext: form.name,
      isFirstField: true,
      filledCount: 0,
      totalFields: form.fields.length,
    });

    dispatch({ type: "SET_GUIDANCE", guidance });
    dispatch({ type: "SET_PHASE", phase: "speaking" });

    if (firstField.element && typeof (firstField.element as HTMLInputElement).focus === "function") {
      focusField(firstField.element as HTMLInputElement);
    }

    speak(guidance);
  }, [analyzeCurrentForm, speak]);

  const handleTranscriptCommit = useCallback(async () => {
    if (!state.form || state.transcript.trim().length === 0) return;

    const currentField = state.form.fields[state.currentFieldIndex];
    if (!currentField) return;

    const value = state.transcript.trim();
    dispatch({ type: "SET_PHASE", phase: "processing" });

    const filled = fillField(currentField.element as HTMLInputElement, value);
    if (filled) {
      dispatch({ type: "UPDATE_FIELD_VALUE", fieldId: currentField.id, value });
    }

    dispatch({ type: "SET_TRANSCRIPT", transcript: "" });

    const hasMore = state.currentFieldIndex < state.form.fields.length - 1;
    if (hasMore) {
      const nextField = state.form.fields[state.currentFieldIndex + 1];
      const transition = await generateTransitionGuidance(
        currentField.label,
        nextField.label,
        state.form.name
      );

      dispatch({ type: "SET_GUIDANCE", guidance: transition });
      dispatch({ type: "NEXT_FIELD" });
      dispatch({ type: "SET_PHASE", phase: "speaking" });

      if (nextField.element) {
        focusField(nextField.element as HTMLInputElement);
      }

      speak(transition);
    } else {
      const completion = await generateCompletionMessage(state.form.name, state.form.fields.length);
      dispatch({ type: "SET_GUIDANCE", guidance: completion });
      dispatch({ type: "SET_PHASE", phase: "speaking" });
      speak(completion);
    }
  }, [state.form, state.transcript, state.currentFieldIndex, speak]);

  const nextField = useCallback(async () => {
    if (!state.form) return;
    const next = state.currentFieldIndex + 1;
    if (next >= state.form.fields.length) return;

    const field = state.form.fields[next];
    const guidance = await generateFieldGuidance({
      fieldLabel: field.label,
      fieldType: field.type,
      placeholder: field.placeholder,
      required: field.required,
      formContext: state.form.name,
      isFirstField: next === 0,
      isLastField: next === state.form.fields.length - 1,
      filledCount: next,
      totalFields: state.form.fields.length,
      currentValue: state.filledValues[field.id],
    });

    dispatch({ type: "SET_GUIDANCE", guidance });
    dispatch({ type: "NEXT_FIELD" });
    dispatch({ type: "SET_PHASE", phase: "speaking" });

    if (field.element) {
      focusField(field.element as HTMLInputElement);
    }

    speak(guidance);
  }, [state.form, state.currentFieldIndex, state.filledValues, speak]);

  const prevField = useCallback(async () => {
    if (!state.form) return;
    const prev = state.currentFieldIndex - 1;
    if (prev < 0) return;

    const field = state.form.fields[prev];
    const guidance = await generateFieldGuidance({
      fieldLabel: field.label,
      fieldType: field.type,
      placeholder: field.placeholder,
      required: field.required,
      formContext: state.form.name,
      isFirstField: prev === 0,
      isLastField: prev === state.form.fields.length - 1,
      filledCount: prev,
      totalFields: state.form.fields.length,
      currentValue: state.filledValues[field.id],
    });

    dispatch({ type: "SET_GUIDANCE", guidance });
    dispatch({ type: "PREV_FIELD" });
    dispatch({ type: "SET_PHASE", phase: "speaking" });

    if (field.element) {
      focusField(field.element as HTMLInputElement);
    }

    speak(guidance);
  }, [state.form, state.currentFieldIndex, state.filledValues, speak]);

  const repeatGuidance = useCallback(async () => {
    if (!state.form || state.currentFieldIndex >= state.form.fields.length) return;
    const field = state.form.fields[state.currentFieldIndex];

    dispatch({ type: "SET_PHASE", phase: "processing" });
    const guidance = await generateFieldGuidance({
      fieldLabel: field.label,
      fieldType: field.type,
      placeholder: field.placeholder,
      required: field.required,
      formContext: state.form.name,
      isFirstField: state.currentFieldIndex === 0,
      isLastField: state.currentFieldIndex === state.form.fields.length - 1,
      filledCount: state.currentFieldIndex,
      totalFields: state.form.fields.length,
      currentValue: state.filledValues[field.id],
    });

    dispatch({ type: "SET_GUIDANCE", guidance });
    dispatch({ type: "SET_PHASE", phase: "speaking" });
    speak(guidance);
  }, [state.form, state.currentFieldIndex, state.filledValues, speak]);

  const reset = useCallback(() => {
    stopListening();
    stopSpeaking();
    dispatch({ type: "RESET" });
  }, [stopListening, stopSpeaking]);

  useEffect(() => {
    if (!state.active) return;
    if (state.phase !== "listening") return;
    if (!isListening && transcript.trim().length > 0) {
      handleTranscriptCommit();
    }
  }, [isListening, transcript, state.active, state.phase, handleTranscriptCommit]);

  return {
    state,
    activate,
    deactivate,
    startGuidance,
    nextField,
    prevField,
    repeatGuidance,
    reset,
    toggleListening,
    startListening,
    stopListening,
    isListening,
  };
}

function extractPageName(): string {
  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "page";
  return last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
