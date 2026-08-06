import { z } from "zod";

export const TeamMemberStatusSchema = z.enum(["active", "away", "inactive"]);
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>;

export const TeamMemberSchema = z.object({
  id: z.coerce.number().int().nonnegative(),
  teamId: z.coerce.number().int().nonnegative(),
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("L'email est invalide").optional(),
  role: z.string().min(1, "Le rôle est requis"),
  status: TeamMemberStatusSchema,
  avatar: z.string().min(1, "L'avatar est requis"),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamInfoSchema = z.object({
  id: z.coerce.number().int().nonnegative(),
  name: z.string().min(1, "Le nom de l'équipe est requis"),
  description: z.string().min(1, "La description est requise"),
  color: z.string().min(1),
  members: z.coerce.number().int().nonnegative(),
  membersList: z.array(TeamMemberSchema),
});
export type TeamInfo = z.infer<typeof TeamInfoSchema>;

export const CreateTeamPayloadSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis"),
  description: z.string().min(1, "La description est requise"),
  color: z.string().min(1).default("bg-blue-500"),
  members: z
    .array(
      z.object({
        name: z.string().min(1, "Le nom est requis"),
        email: z.string().email("L'email est invalide").optional(),
        role: z.string().min(1, "Le rôle est requis"),
        status: TeamMemberStatusSchema,
        avatar: z.string().min(1, "L'avatar est requis"),
      }),
    )
    .default([]),
});
export type CreateTeamPayload = z.infer<typeof CreateTeamPayloadSchema>;

export const CreateTeamMemberPayloadSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("L'email est invalide").optional(),
  role: z.string().min(1, "Le rôle est requis"),
  status: TeamMemberStatusSchema,
  avatar: z.string().min(1, "L'avatar est requis"),
});
export type CreateTeamMemberPayload = z.infer<
  typeof CreateTeamMemberPayloadSchema
>;

export const UpdateTeamPayloadSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis").optional(),
  description: z.string().min(1, "La description est requise").optional(),
  color: z.string().min(1).optional(),
});
export type UpdateTeamPayload = z.infer<typeof UpdateTeamPayloadSchema>;

export const UpdateTeamMemberPayloadSchema = z.object({
  name: z.string().min(1, "Le nom est requis").optional(),
  email: z.string().email("L'email est invalide").optional(),
  role: z.string().min(1, "Le rôle est requis").optional(),
  status: TeamMemberStatusSchema.optional(),
  avatar: z.string().min(1, "L'avatar est requis").optional(),
});
export type UpdateTeamMemberPayload = z.infer<
  typeof UpdateTeamMemberPayloadSchema
>;

export { rolesConfig, teams } from "@/data/teams";
export type { Team, Member } from "@/data/teams";
