import type { StageName } from "@/config/app.config";

export type Stage = StageName;

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  /** Normalized UTC instant. */
  createdAt: Date;
  /** Calendar date in the configured timezone, YYYY-MM-DD. Used for week bucketing. */
  createdDate: string;
  stage: Stage;
  quizScore?: number;
  quizResult?: string;
  source?: string;
}

export interface WeeklyAdSpend {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  amount: number;
}

export type DateFormat = "serial" | "m/d/yyyy" | "mm/dd/yy" | "yyyy-mm-dd" | "yyyy-mm-dd hh:mm" | "iso";

export interface RejectedRow {
  /** 1-based row number in the source (header = row 1), when known. */
  row?: number;
  id?: string;
  reason: string;
}

export interface DataQualityReport {
  rawRows: number;
  testRowsRemoved: number;
  duplicatesRemoved: number;
  /** Rows whose date was text and had to be parsed into a real date. */
  datesNormalized: number;
  dateFormats: Partial<Record<DateFormat, number>>;
  rowsRejected: number;
  rejected: RejectedRow[];
  cleanRows: number;
}

export interface CleanedLeads {
  leads: Lead[];
  quality: DataQualityReport;
}
