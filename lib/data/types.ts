import type { CleanedLeads, WeeklyAdSpend } from "@/lib/domain/types";

/**
 * Contract every data source implements (Google Sheets, mock, GoHighLevel...).
 * Adapters return cleaned domain objects; pages never know where data came from.
 */
export interface DataSource {
  readonly name: string;
  /** Cleaned, de-duplicated leads plus the data-quality report for the run. */
  getLeads(): Promise<CleanedLeads>;
  getAdSpend(): Promise<WeeklyAdSpend[]>;
}
