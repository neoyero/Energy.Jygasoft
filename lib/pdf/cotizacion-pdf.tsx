import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Generación server-side del PDF de una cotización (Node puro, sin Chromium).
 * Se usa para adjuntarlo al correo al cliente. La vista en pantalla es la
 * página imprimible; este PDF es el documento formal adjunto.
 */

export interface CotizacionPdfItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

export interface CotizacionPdfData {
  folio: string;
  version: number;
  fecha: string; // ISO o YYYY-MM-DD
  validaHasta: string | null;
  estado: string;
  moneda: string;
  cliente: { nombre: string; rfc: string | null } | null;
  sistema: {
    capacidadKwp: number | null;
    paneles: number | null;
    inversor: string | null;
    produccionAnualKwh: number | null;
    ahorroAnualMxn: number | null;
    paybackAnios: number | null;
    esquema: string | null;
  };
  items: CotizacionPdfItem[];
  subtotal: number;
  iva: number;
  total: number;
}

const BRAND = "#1f7a3d";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1c1917", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  empresa: { fontSize: 16, fontWeight: 700, color: BRAND },
  empresaSub: { fontSize: 8, color: "#78716c", marginTop: 2 },
  docTitle: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  docMeta: { fontSize: 8, color: "#57534e", textAlign: "right", marginTop: 2 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
    borderBottom: "1 solid #e7e5e4",
    paddingBottom: 2,
  },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 110, color: "#78716c" },
  value: { flex: 1 },
  th: {
    flexDirection: "row",
    backgroundColor: "#f5f5f4",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontWeight: 700,
    fontSize: 8,
  },
  td: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottom: "1 solid #f0efee",
  },
  cDesc: { flex: 1 },
  cNum: { width: 60, textAlign: "right" },
  cMoney: { width: 80, textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 2,
    borderTop: "1 solid #d6d3d1",
    fontWeight: 700,
    fontSize: 11,
    color: BRAND,
  },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: "#a8a29e", textAlign: "center" },
});

function money(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda || "MXN",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function fecha(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
}

function n(v: number | null, suf = ""): string {
  return v === null || v === undefined ? "—" : `${v}${suf}`;
}

function CotizacionDocument({ data }: { data: CotizacionPdfData }) {
  return (
    <Document title={`Cotización ${data.folio}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.empresa}>JYGASOFT Energy</Text>
            <Text style={s.empresaSub}>Energía solar fotovoltaica · México</Text>
          </View>
          <View>
            <Text style={s.docTitle}>Cotización</Text>
            <Text style={s.docMeta}>Folio: {data.folio} · v{data.version}</Text>
            <Text style={s.docMeta}>Fecha: {fecha(data.fecha)}</Text>
            <Text style={s.docMeta}>Vigencia: {fecha(data.validaHasta)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Cliente</Text>
          <View style={s.row}>
            <Text style={s.label}>Nombre</Text>
            <Text style={s.value}>{data.cliente?.nombre ?? "—"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>RFC</Text>
            <Text style={s.value}>{data.cliente?.rfc ?? "—"}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Sistema propuesto</Text>
          <View style={s.row}>
            <Text style={s.label}>Capacidad</Text>
            <Text style={s.value}>{n(data.sistema.capacidadKwp, " kWp")}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Paneles</Text>
            <Text style={s.value}>{n(data.sistema.paneles)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Inversor</Text>
            <Text style={s.value}>{data.sistema.inversor ?? "—"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Producción anual</Text>
            <Text style={s.value}>{n(data.sistema.produccionAnualKwh, " kWh")}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Ahorro anual</Text>
            <Text style={s.value}>
              {data.sistema.ahorroAnualMxn === null
                ? "—"
                : money(data.sistema.ahorroAnualMxn, data.moneda)}
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Retorno (payback)</Text>
            <Text style={s.value}>{n(data.sistema.paybackAnios, " años")}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Partidas</Text>
          <View style={s.th}>
            <Text style={s.cDesc}>Descripción</Text>
            <Text style={s.cNum}>Cant.</Text>
            <Text style={s.cMoney}>P. unitario</Text>
            <Text style={s.cMoney}>Importe</Text>
          </View>
          {data.items.length === 0 ? (
            <View style={s.td}>
              <Text style={s.cDesc}>Sin partidas.</Text>
            </View>
          ) : (
            data.items.map((it, i) => (
              <View style={s.td} key={i}>
                <Text style={s.cDesc}>{it.descripcion}</Text>
                <Text style={s.cNum}>{it.cantidad}</Text>
                <Text style={s.cMoney}>{money(it.precioUnitario, data.moneda)}</Text>
                <Text style={s.cMoney}>{money(it.importe, data.moneda)}</Text>
              </View>
            ))
          )}

          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text>Subtotal</Text>
              <Text>{money(data.subtotal, data.moneda)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text>IVA</Text>
              <Text>{money(data.iva, data.moneda)}</Text>
            </View>
            <View style={s.totalGrand}>
              <Text>Total</Text>
              <Text>{money(data.total, data.moneda)}</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer}>
          JYGASOFT Energy · Cotización {data.folio} v{data.version} · Precios en{" "}
          {data.moneda}. Documento informativo; no es un comprobante fiscal.
        </Text>
      </Page>
    </Document>
  );
}

/** Renderiza la cotización a un Buffer PDF (para adjuntar al correo). */
export async function renderCotizacionPdf(data: CotizacionPdfData): Promise<Buffer> {
  return renderToBuffer(<CotizacionDocument data={data} />);
}
