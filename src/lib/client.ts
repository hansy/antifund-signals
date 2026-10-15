import { createElement, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { corpusSchema } from "./contracts";

export function ResearchProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return createElement(QueryClientProvider, { client }, children);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export function useCorpus() {
  return useQuery({
    queryKey: ["corpus"],
    queryFn: async () => corpusSchema.parse(await request("/api/corpus")),
  });
}
