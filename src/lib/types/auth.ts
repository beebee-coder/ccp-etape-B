import { z } from "zod";

import type { JwtPayload } from "@/lib/auth/jwt";
import type { AdminUser } from "@/lib/auth/admin";
import type { AuthenticatedUser } from "@/lib/api/handlers";

export const RoleSchema = z.enum(["admin", "chef_de_bloc", "chef_de_quart", "user"]);
export type Role = z.infer<typeof RoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: RoleSchema,
  approved: z.boolean(),
  image: z.string().url().optional(),
  lastSyncAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginPayloadSchema = z.object({
  username: z.string().min(1, "L'identifiant est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
  callbackUrl: z.string().url().optional(),
});
export type LoginPayload = z.infer<typeof LoginPayloadSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  csrfToken: z.string(),
  user: AuthUserSchema,
  callbackUrl: z.string().nullable(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshTokenPayloadSchema = z.object({
  token: z.string().min(1, "Le token est requis"),
});
export type RefreshTokenPayload = z.infer<typeof RefreshTokenPayloadSchema>;

export { JwtPayload, AdminUser, AuthenticatedUser };
