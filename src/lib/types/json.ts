import { z } from "zod";

export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export type JSONObject = {
  [key: string]: JSONValue;
};

export type JSONArray = JSONValue[];

export type Json = JSONValue;
export type JsonInput = JSONValue;
export type JsonOutput = JSONValue;
export type JsonRecord = Record<string, JSONValue>;

export type JsonPrimitive = string | number | boolean | null;

export const JSONValueSchema: z.ZodType<JSONValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.lazy(() => JSONValueSchema)),
  z.array(z.lazy(() => JSONValueSchema)),
]);

export const JsonSchema = JSONValueSchema;
export const JsonInputSchema = JSONValueSchema;
export const JsonOutputSchema = JSONValueSchema;

export type JsonSchema = typeof JSONValueSchema;
