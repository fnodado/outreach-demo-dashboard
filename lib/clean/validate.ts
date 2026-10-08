import { z } from "zod";
import { STAGES, type StageName } from "@/config/app.config";

const stageByKey = new Map<string, StageName>(STAGES.map((s) => [s.toLowerCase().replace(/\s+/g, " "), s]));

export function normalizeStage(value: unknown): StageName | undefined {
  if (typeof value !== "string") return undefined;
  return stageByKey.get(value.trim().toLowerCase().replace(/\s+/g, " "));
}

const optionalText = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}, z.string().optional());

/** Non-numeric scores become undefined rather than rejecting the lead. */
const optionalNumber = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[%\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

export const leadRowSchema = z.object({
  id: optionalText,
  name: optionalText,
  email: optionalText,
  phone: optionalText,
  stage: z.preprocess(
    (v) => normalizeStage(v) ?? v,
    z.enum(STAGES, { error: (iss) => `unknown stage "${String(iss.input ?? "")}"` }),
  ),
  quizScore: optionalNumber,
  quizResult: optionalText,
  source: optionalText,
});

export type ValidLeadRow = z.infer<typeof leadRowSchema>;
