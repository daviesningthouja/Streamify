import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "src",
    "service-worker",
    "stream-sync-sw.js",
  );

  const file = await readFile(filePath);

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=UTF-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}