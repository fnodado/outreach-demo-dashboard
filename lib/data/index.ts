import "server-only";
import type { DataSource } from "./types";
import { mockDataSource } from "./mock/adapter";
import { sheetsDataSource } from "./sheets/adapter";

/**
 * Picks the adapter from DATA_SOURCE ("sheets" | "mock").
 * Defaults to Sheets when SHEET_ID is set, otherwise mock data.
 */
export function getDataSource(): DataSource {
  const choice = process.env.DATA_SOURCE ?? (process.env.SHEET_ID ? "sheets" : "mock");
  switch (choice) {
    case "sheets":
      return sheetsDataSource;
    case "mock":
      return mockDataSource;
    default:
      throw new Error(`Unknown DATA_SOURCE "${choice}"`);
  }
}

export type { DataSource };
