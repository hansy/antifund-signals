import { z } from "zod";
import data from "../../data/opportunity-collection.json";
import type { Insight } from "./contracts";

const recordSchema = z.object({
  id: z.string().min(1),
  placement: z.enum(["opportunity", "supporting", "project"]),
  title: z.string().min(1),
  reason: z.string().min(1),
  parentId: z.string().min(1).optional(),
});
export const collectionSchema = z
  .object({
    version: z.literal("opportunity-screen-v1"),
    records: z.array(recordSchema),
    groups: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        placement: z.enum(["opportunity", "supporting"]),
        summary: z.string().min(1),
        boundary: z.string().min(1),
        section: z.string().min(1),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const all = [...value.records, ...value.groups];
    const ids = new Set(all.map((x) => x.id));
    if (ids.size !== all.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate collection identity",
      });
    for (const record of value.records) {
      const parent = all.find((x) => x.id === record.parentId);
      if (record.placement === "supporting") {
        // One level of retained records beneath an opportunity or a virtual research area.
        if (
          !parent ||
          parent.id === record.id ||
          ("parentId" in parent && parent.parentId) ||
          parent.placement === "project"
        )
          ctx.addIssue({
            code: "custom",
            message: `Invalid supporting parent: ${record.id}`,
          });
      } else if (record.parentId)
        ctx.addIssue({
          code: "custom",
          message: "Only supporting records have parents",
        });
    }
    for (const group of value.groups)
      if (!value.records.some((x) => x.parentId === group.id))
        ctx.addIssue({
          code: "custom",
          message: `Empty collection group: ${group.id}`,
        });
  });
export const opportunityCollection = collectionSchema.parse(data);
export type CollectionEntry = {
  id: string;
  title: string;
  summary: string;
  placement: "opportunity" | "supporting" | "project";
  group: boolean;
};
export function collectionEntries(insights: Insight[]): CollectionEntry[] {
  const saved = new Map(insights.map((x) => [x.id, x]));
  return [
    ...opportunityCollection.records
      .filter((x) => saved.has(x.id))
      .map((x) => ({
        id: x.id,
        title: x.title,
        placement: x.placement,
        summary: saved.get(x.id)!.summary,
        group: false,
      })),
    ...opportunityCollection.groups.map((x) => ({ ...x, group: true })),
  ];
}
export function collectionRecord(id?: string) {
  return opportunityCollection.records.find((x) => x.id === id);
}
export function collectionGroup(id?: string | null) {
  return opportunityCollection.groups.find((x) => x.id === id);
}
export function supportingRecords(id: string) {
  return opportunityCollection.records.filter((x) => x.parentId === id);
}
/** Unscreened additions stay readable by URL but never silently become main-list opportunities. */
export function collectionIncludes(
  entry: CollectionEntry,
  view: "main" | "supporting" | "project",
) {
  if (view === "main") return entry.placement === "opportunity";
  if (view === "project") return entry.placement === "project";
  if (entry.placement !== "supporting") return false;
  const parent = collectionGroup(collectionRecord(entry.id)?.parentId);
  return !parent || parent.placement !== "supporting";
}
