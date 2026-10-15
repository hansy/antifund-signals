import { test, expect } from "bun:test";
import { previousRuntimeEnded } from "../scripts/worker-runtime";
test("only a recorded, different container runtime proves the old call is gone", () => {
  expect(previousRuntimeEnded(undefined, "boot:pid:[2]")).toBe(false);
  expect(previousRuntimeEnded("", "boot:pid:[2]")).toBe(false);
  expect(previousRuntimeEnded("boot:pid:[2]", "boot:pid:[2]")).toBe(false);
  expect(previousRuntimeEnded("boot:pid:[1]", "boot:pid:[2]")).toBe(true);
  expect(previousRuntimeEnded("oldboot:pid:[2]", "boot:pid:[2]")).toBe(true);
});
