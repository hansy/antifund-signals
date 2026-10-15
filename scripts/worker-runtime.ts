import { readFile, readlink } from "node:fs/promises";

// A new kernel boot or PID namespace proves the previous container's processes
// cannot still be executing. Ordinary supervisor restarts keep this identity.
export async function runtimeIdentity() {
  return `${(await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim()}:${await readlink("/proc/1/ns/pid")}`;
}
export function previousRuntimeEnded(previous: unknown, current: string) {
  return (
    typeof previous === "string" && previous.length > 0 && previous !== current
  );
}
