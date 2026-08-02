import { z } from "zod";

export const TeamMemberStatusSchema = z.enum(["active", "away", "inactive"]);
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>;

export const TeamMemberSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  status: TeamMemberStatusSchema,
  avatar: z.string().min(1),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamInfoSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  description: z.string(),
  color: z.string().min(1),
  members: z.number().int().nonnegative(),
  members_list: z.array(TeamMemberSchema),
});
export type TeamInfo = z.infer<typeof TeamInfoSchema>;

export { teams, rolesConfig } from "@/data/teams";
export type { Team, Member } from "@/data/teams";
