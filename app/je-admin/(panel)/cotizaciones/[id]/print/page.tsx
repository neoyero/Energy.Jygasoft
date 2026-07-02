import { notFound } from "next/navigation";

import { paginaTenant } from "@/lib/admin/guard";
import { type Rol } from "@/lib/admin/rbac";
import { getCotizacion, type DashboardScope } from "@/lib/admin/queries";
import { formatMXN } from "@/lib/admin/format";
import { PrintButton } from "@/components/admin/cotizaciones/print-button";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// Formateador de fecha absoluta es-MX para el documento (sin "hace N min").
const FECHA_DOC = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Fecha absoluta es-MX a partir de un ISO; ISO nulo/invalido -> "—". */
function fmtFechaDoc(iso: string | null): string {
  if (iso === null) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return FECHA_DOC.format(date);
}

const ESQUEMA_LABEL: Record<string, string> = {
  net_metering: "Net Metering",
  net_billing: "Net Billing",
  venta_total: "Venta Total",
};

/** Entero localizado es-MX; null/NaN -> "—". */
function fmtEntero(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Vista IMPRIMIBLE de la cotizacion (D4): documento A4 sobrio pensado para
 * imprimir o "Guardar como PDF" desde el navegador. Valida permiso
 * (cotizaciones:view), arma el scope por rol y resuelve el detalle; notFound()
 * si no existe o esta fuera de scope.
 *
 * Hereda el layout de (panel), por eso usa utilidades `print:` para ocultar el
 * disparador de impresion en el papel y centra el contenido en un contenedor
 * de ancho de hoja. El propio shell del panel no se imprime (las acciones que
 * no aplican llevan `print:hidden`).
 */
export default async function CotizacionPrintPage({ params }: Params) {
  const { id } = await params;
  return paginaTenant("cotizaciones", async (user) => {
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };

  const detalle = await getCotizacion(scope, id);
  if (!detalle) notFound();

  const { cotizacion, items, cliente } = detalle;
  const folio = cotizacion.folio ?? `#${cotizacion.id}`;
  const moneda = cotizacion.moneda;

  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-stone-900">
      {/* Barra de acciones (no se imprime). */}
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* Encabezado del documento. */}
      <header className="flex items-start justify-between border-b border-stone-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">JYGASOFT Energy</h1>
          <p className="text-sm text-stone-500">Cotización de sistema solar</p>
        </div>
        <div className="text-right text-sm">
          <p>
            <span className="text-stone-500">Folio: </span>
            <span className="font-medium">{folio}</span>
          </p>
          <p>
            <span className="text-stone-500">Versión: </span>
            <span className="font-medium">{cotizacion.version}</span>
          </p>
          <p>
            <span className="text-stone-500">Fecha: </span>
            <span className="font-medium">{fmtFechaDoc(cotizacion.createdAt)}</span>
          </p>
          <p>
            <span className="text-stone-500">Vigencia: </span>
            <span className="font-medium">{fmtFechaDoc(cotizacion.validaHasta)}</span>
          </p>
        </div>
      </header>

      {/* Datos del cliente. */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Cliente
        </h2>
        <p className="mt-1 text-base font-medium">{cliente?.nombre ?? "—"}</p>
        {cliente?.tipoPersona ? (
          <p className="text-sm text-stone-500">
            {cliente.tipoPersona.startsWith("pm_")
              ? "Persona moral"
              : "Persona física"}
          </p>
        ) : null}
      </section>

      {/* Resumen del sistema. */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Sistema propuesto
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between border-b border-stone-100 py-1">
            <dt className="text-stone-500">Capacidad</dt>
            <dd className="font-medium">
              {cotizacion.capacidadKwp !== null
                ? `${cotizacion.capacidadKwp} kWp`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1">
            <dt className="text-stone-500">Paneles</dt>
            <dd className="font-medium">{fmtEntero(cotizacion.paneles)}</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1">
            <dt className="text-stone-500">Inversor</dt>
            <dd className="font-medium">{cotizacion.inversor ?? "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1">
            <dt className="text-stone-500">Esquema CFE</dt>
            <dd className="font-medium">
              {cotizacion.esquema
                ? (ESQUEMA_LABEL[cotizacion.esquema] ?? cotizacion.esquema)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1">
            <dt className="text-stone-500">Producción anual</dt>
            <dd className="font-medium">
              {cotizacion.produccionAnualKwh !== null
                ? `${fmtEntero(cotizacion.produccionAnualKwh)} kWh`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1">
            <dt className="text-stone-500">Ahorro anual</dt>
            <dd className="font-medium">
              {cotizacion.ahorroAnualMxn !== null
                ? formatMXN(cotizacion.ahorroAnualMxn)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1">
            <dt className="text-stone-500">Retorno de inversión</dt>
            <dd className="font-medium">
              {cotizacion.paybackAnios !== null
                ? `${cotizacion.paybackAnios} años`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tabla de partidas. */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Partidas
        </h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-stone-500">
              <th className="py-2 pr-2 font-medium">Descripción</th>
              <th className="py-2 px-2 text-right font-medium">Cant.</th>
              <th className="py-2 px-2 text-right font-medium">P. unitario</th>
              <th className="py-2 pl-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-center text-stone-400">
                  Sin partidas
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-stone-100 align-top">
                  <td className="py-2 pr-2">
                    <span>{item.descripcion}</span>
                    {item.equipoMarca || item.equipoModelo ? (
                      <span className="block text-xs text-stone-400">
                        {[item.equipoMarca, item.equipoModelo]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 px-2 text-right">{fmtEntero(item.cantidad)}</td>
                  <td className="py-2 px-2 text-right">
                    {formatMXN(item.precioUnitario)}
                  </td>
                  <td className="py-2 pl-2 text-right">{formatMXN(item.importe)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Totales. */}
      <section className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-stone-500">Subtotal</dt>
            <dd>{formatMXN(cotizacion.subtotal)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-stone-500">IVA</dt>
            <dd>{formatMXN(cotizacion.iva)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-stone-300 py-2 text-base font-bold">
            <dt>Total</dt>
            <dd>
              {formatMXN(cotizacion.total)}{" "}
              <span className="text-xs font-normal text-stone-500">{moneda}</span>
            </dd>
          </div>
        </dl>
      </section>

      <footer className="mt-10 border-t border-stone-200 pt-4 text-center text-xs text-stone-400">
        JYGASOFT Energy · Documento generado el {fmtFechaDoc(new Date().toISOString())}
      </footer>
    </div>
  );
  });
}
