import { open } from "node:fs/promises";
import { constants } from "node:fs";
// Reports are model-controlled files. Never follow a symlink while reading as supervisor.
export async function readReport(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = await handle.stat();
    if (!s.isFile() || s.size > 100000) throw Error("Invalid report file");
    return JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
}
