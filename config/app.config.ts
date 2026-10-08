// Single source of truth for business rules. Change rules here, not in code.

export const STAGES = [
  "New Lead",
  "Quiz Completed",
  "Interview Scheduled",
  "Interview Done",
  "Offer Sent",
  "Hired",
  "Disqualified",
] as const;

export type StageName = (typeof STAGES)[number];

export const HIRED_STAGE: StageName = "Hired";

export const appConfig = {
  /** IANA timezone that defines calendar days and weeks. */
  timeZone: "America/New_York",
  /** 1 = Monday (ISO). */
  weekStartsOn: 1,

  /** Sheet tab names. */
  tabs: {
    leads: "Leads",
    managers: "Managers",
    managerAssignments: "Manager Assignments",
    adSpend: "Weekly Ad Spend",
    weeklyStats: "Weekly Stats",
  },

  /**
   * Test-row rules. A row is a test row if ANY pattern matches the given field.
   * Patterns are tested against the trimmed raw value.
   */
  testRowRules: {
    name: [/\btest\b/i, /asdf/i, /delete\s*me/i],
    email: [/@example\.com$/i, /^test\b/i, /asdf/i],
  } satisfies Record<string, RegExp[]>,

  dedupe: {
    /** Phones with fewer digits than this are not used as a dedupe key. */
    minPhoneDigits: 7,
    /** Strip a leading US country code ("1") from 11-digit phones. */
    stripUsCountryCode: true,
  },

  /** Seconds before the cached sheet read is refreshed. */
  revalidateSeconds: 60,
} as const;
