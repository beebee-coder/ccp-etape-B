import { z } from "zod";

export const FileStorageSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  url: z.string().url(),
  uploadedBy: z.string().uuid(),
  createdAt: z.date(),
});
export type FileStorage = z.infer<typeof FileStorageSchema>;
