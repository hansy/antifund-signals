import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StageBadge } from "./OpportunityStage";

test("not interesting takes precedence over every lifecycle stage", () => {
  for (const stage of [
    "first-impressions",
    "researching",
    "exploring",
  ] as const) {
    const html = renderToStaticMarkup(
      <StageBadge stage={stage} verdict="not-interested" />,
    );
    expect(html).toContain(">Not interesting</span>");
    expect(html).not.toContain("Researching");
    expect(html).not.toContain("Exploring");
    expect(html).not.toContain("Lead");
  }
});
test("interested and unmarked signals keep their lifecycle badge", () => {
  expect(
    renderToStaticMarkup(
      <StageBadge stage="researching" verdict="interested" />,
    ),
  ).toContain(">Researching</span>");
  expect(
    renderToStaticMarkup(<StageBadge stage="researching" verdict={null} />),
  ).toContain(">Researching</span>");
  expect(
    renderToStaticMarkup(
      <StageBadge stage="first-impressions" verdict={null} />,
    ),
  ).toContain(">Lead</span>");
});
