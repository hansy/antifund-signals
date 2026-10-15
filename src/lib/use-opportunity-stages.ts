import { useQuery } from "@tanstack/react-query";
import { lifecycleViewSchema } from "./opportunity-lifecycle";
export function useOpportunityStages() {
  const actor =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("actor") === "test"
      ? "test"
      : "operator";
  return useQuery({
    queryKey: ["opportunity-stages", actor],
    queryFn: async () => {
      const response = await fetch(`/api/stages?actor=${actor}`, {
        cache: "no-store",
      });
      if (!response.ok) throw Error("Signal stages are unavailable.");
      return lifecycleViewSchema.parse(await response.json());
    },
    refetchInterval: 5000,
    retry: false,
  });
}
