import { NextResponse } from "next/server";
import { pool } from "@/db";

// Health check para Caddy / Cloudflare / Docker healthcheck.
export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      service: "energy-web",
      db: dbOk,
      ts: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
