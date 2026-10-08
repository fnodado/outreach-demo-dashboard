import { cleanLeads } from "@/lib/clean/pipeline";
import type { DataSource } from "@/lib/data/types";
import { mockAdSpend, mockLeadRows } from "./fixtures";

/** Fixture-backed source for local development, tests, and demos without credentials. */
export const mockDataSource: DataSource = {
  name: "Demo data",
  async getLeads() {
    return cleanLeads(mockLeadRows);
  },
  async getAdSpend() {
    return mockAdSpend;
  },
};
