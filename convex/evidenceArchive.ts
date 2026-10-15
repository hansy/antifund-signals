// App-level bound; Convex generated upload URLs support arbitrary file sizes
// with a two-minute POST timeout: https://docs.convex.dev/file-storage/upload-files#limits
// Retain larger evidence on the worker rather than dropping sources.
export const MAX_EVIDENCE_ARCHIVE_BYTES = 64 * 1024 * 1024;
export function validateEvidenceArchive(
  file: { size: number; sha256: string } | null,
  digest: string,
) {
  if (!file || file.size <= 0 || file.size > MAX_EVIDENCE_ARCHIVE_BYTES)
    throw Error("Missing or oversized evidence archive");
  if (!/^[a-f0-9]{64}$/.test(digest)) throw Error("Invalid archive checksum");
  const base64 = btoa(
    String.fromCharCode(...digest.match(/../g)!.map((x) => parseInt(x, 16))),
  );
  if (file.sha256 !== base64) throw Error("Evidence archive checksum mismatch");
}
