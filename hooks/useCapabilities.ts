"use client";
import useSWR from "swr";
import { dataFetcher } from "@/lib/client";
export function useCapabilities() {
  const { data } = useSWR("/api/public", dataFetcher);
  return { aiEnabled: !!data?.aiEnabled };
}
