import { STAGES, type StageName } from "@/config/app.config";

/** Color follows the stage, never its rank: fixed slot per stage. */
export const stageColor = Object.fromEntries(
  STAGES.map((s, i) => [s, `var(--stage-${i + 1})`]),
) as Record<StageName, string>;
