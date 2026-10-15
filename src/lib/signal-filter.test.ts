import { expect, test } from "bun:test";
import { signalCategory } from "./signal-filter";
test("signal categories follow badge precedence", () => {
  expect(signalCategory()).toBe("Lead");
  expect(signalCategory({ stage: "first-impressions", verdict: null })).toBe(
    "Lead",
  );
  expect(signalCategory({ stage: "researching", verdict: "interested" })).toBe(
    "Researching",
  );
  expect(signalCategory({ stage: "researching", verdict: null })).toBe(
    "Researching",
  );
  expect(signalCategory({ stage: "exploring", verdict: null })).toBe(
    "Exploring",
  );
  expect(
    signalCategory({ stage: "researching", verdict: "not-interested" }),
  ).toBe("Not Interested");
  expect(
    signalCategory({ stage: "exploring", verdict: "not-interested" }),
  ).toBe("Not Interested");
});
