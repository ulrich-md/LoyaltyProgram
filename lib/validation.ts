import { z } from "zod";
export const uuid = z.uuid();
export const registration = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .transform((x) => x.toLowerCase()),
  phone: z.string().max(30).default(""),
  marketing: z.boolean().default(false),
  accept: z.literal(true),
});
export const operation = z.object({
  business: uuid,
  scan: uuid,
  kind: z.enum(["stamp", "redeem", "reverse"]),
  key: uuid,
  reward: uuid.nullish(),
  reverse: uuid.nullish(),
  reason: z.string().max(500).nullish(),
});
export const business = z.object({
  id: uuid.nullish(),
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  logo: z
    .union([z.url().refine((x) => x.startsWith("https://")), z.literal("")])
    .default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  program: z.string().min(2).max(150),
  goal: z.coerce.number().int().min(2).max(30),
  reward: z.string().min(2).max(300),
  terms: z.string().min(10).max(3000),
  privacy: z.string().min(10).max(3000),
  status: z.enum(["draft", "active", "suspended"]),
  provider: z.enum(["web", "pass_studio"]).default("web"),
  template_id: z.string().max(200).default(""),
});
