import { z } from "zod";

export const LocationTypeSchema = z.enum(["centrale", "groupe", "global"]);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const LocationRefSchema = z.object({
  locationType: LocationTypeSchema,
  blocCode: z.string().optional(),
  equipementCode: z.string().optional(),
  groupePath: z.string().optional(),
  locationPath: z.string().optional(),
  alarmCode: z.string().optional(),
  vueCode: z.string().optional(),
});
export type LocationRef = z.infer<typeof LocationRefSchema>;

export const LocationHeaderSchema = z.object({
  type: LocationTypeSchema,
  path: z.string().min(1),
  bloc: z.string().optional(),
  equipement: z.string().optional(),
  libelle: z.string().optional(),
});
export type LocationHeader = z.infer<typeof LocationHeaderSchema>;
