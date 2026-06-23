import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import cpMapAgs from "@/lib/data/cp-municipios.json";

/**
 * Lookup CP → estado + municipio (+ colonias) usando el Catálogo Nacional de
 * Códigos Postales (SEPOMEX) cargado en `codigos_postales`. Cobertura nacional.
 *   pnpm db:import-cp  carga/actualiza la tabla.
 *
 * Fallback: si la tabla aún no existe o el CP no está en BD, se intenta el mapa
 * local de Aguascalientes (datos históricos) para no regresar esa cobertura.
 */
export const runtime = "nodejs";

const AGS_MAP = cpMapAgs as Record<string, string>;

function agsFallback(cp: string) {
  const municipio = AGS_MAP[cp];
  if (!municipio) return null;
  return { found: true, cp, estado: "Aguascalientes", municipio, ciudad: null, colonias: [] };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cp: string }> },
) {
  const { cp } = await params;
  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ found: false }, { status: 400 });
  }

  const headers = { "Cache-Control": "public, max-age=86400" };

  try {
    const rows = await db
      .select({
        estado: schema.codigosPostales.dEstado,
        municipio: schema.codigosPostales.dMnpio,
        ciudad: schema.codigosPostales.dCiudad,
        colonia: schema.codigosPostales.dAsenta,
      })
      .from(schema.codigosPostales)
      .where(sql`${schema.codigosPostales.dCodigo} = ${cp}`)
      .orderBy(schema.codigosPostales.dAsenta);

    if (rows.length > 0) {
      const first = rows[0];
      const colonias = Array.from(
        new Set(rows.map((r) => r.colonia).filter((c): c is string => Boolean(c))),
      );
      return NextResponse.json(
        { found: true, cp, estado: first.estado, municipio: first.municipio, ciudad: first.ciudad, colonias },
        { headers },
      );
    }
  } catch {
    // Tabla aún no creada / sin cargar: cae al fallback local.
  }

  const fallback = agsFallback(cp);
  if (fallback) return NextResponse.json(fallback, { headers });

  return NextResponse.json({ found: false });
}
