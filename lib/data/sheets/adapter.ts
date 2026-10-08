import "server-only";
import { unstable_cache } from "next/cache";
import { appConfig } from "@/config/app.config";
import { cleanLeads } from "@/lib/clean/pipeline";
import type { DataSource } from "@/lib/data/types";
import { fetchTabs } from "./client";
import { mapAdSpend, mapLeads } from "./mapping";

const { tabs, timeZone, revalidateSeconds } = appConfig;

// One batchGet per refresh window. Only raw cell values are cached; cleaning runs on read.
const readTabs = unstable_cache(() => fetchTabs([tabs.leads, tabs.adSpend]), ["sheet-tabs"], {
  tags: ["sheet"],
  revalidate: revalidateSeconds,
});

export const sheetsDataSource: DataSource = {
  name: "Google Sheets",
  async getLeads() {
    const grid = await readTabs();
    return cleanLeads(mapLeads(grid[tabs.leads], tabs.leads), timeZone);
  },
  async getAdSpend() {
    const grid = await readTabs();
    return mapAdSpend(grid[tabs.adSpend], timeZone, tabs.adSpend);
  },
};
