import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Términos y Condiciones de uso del sitio web de Jygasoft Energy: alcance de la información, estimaciones, cotizaciones, trámite CFE, propiedad intelectual y responsabilidad.",
  alternates: { canonical: "/legal/terminos" },
  robots: { index: true, follow: true },
};

const ACTUALIZACION = "20 de junio de 2026";

export default function Terminos() {
  return (
    <main>
      {/* Cabecera con banner de marca (homologada con Aviso de Privacidad) */}
      <section className="relative isolate overflow-hidden bg-brand">
        <Image
          src="/legal-banner.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-60"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand via-brand/85 to-brand/40" />
        <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-10">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-mint">
            Legal
          </span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Términos y Condiciones
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-light text-brand-mint">
            Última actualización: {ACTUALIZACION}. Documento base sujeto a validación
            por asesoría legal antes de su publicación definitiva.
          </p>
        </div>
      </section>

      <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10">
        <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:text-brand prose-headings:font-bold prose-a:text-brand-green">
          <p className="lead">
            Estos Términos y Condiciones (los “Términos”) regulan el acceso y uso del
            sitio web de <strong>Jygasoft Energy</strong> (el “Sitio”). Al navegar,
            utilizar la calculadora o enviar tus datos a través de nuestros
            formularios, aceptas estos Términos en su totalidad.
          </p>

          <h2>1. Objeto y alcance</h2>
          <p>
            El Sitio tiene fines <strong>informativos y de contacto comercial</strong>.
            A través de él damos a conocer nuestros servicios de energía solar, ofrecemos
            una calculadora de ahorro y facilitamos que solicites una asesoría o
            cotización. El uso del Sitio no genera, por sí mismo, una relación
            contractual de prestación de servicios.
          </p>

          <h2>2. Naturaleza de las estimaciones (calculadora)</h2>
          <p>
            Los resultados de la calculadora —dimensionamiento, número de paneles,
            inversión, ahorro y retorno— son <strong>estimaciones referenciales</strong>
            generadas con parámetros promedio y los datos que proporcionas. No
            constituyen una oferta, garantía de resultados ni una propuesta técnica
            formal.
          </p>
          <p>
            El ahorro real depende de tu consumo, tarifa de CFE, esquema de
            interconexión, condiciones del inmueble y radiación de la zona. La energía
            excedente que inyectes a la red se liquida a <strong>PML</strong> (precio
            marginal local), generalmente menor a la tarifa de consumo.
          </p>

          <h2>3. Cotizaciones y propuestas</h2>
          <p>
            Cualquier cotización o propuesta es <strong>informativa y no vinculante</strong>
            hasta que se formalice mediante un contrato específico firmado por ambas
            partes. Los precios, alcances y tiempos pueden variar tras el levantamiento
            técnico y según disponibilidad de equipos.
          </p>

          <h2>4. Trámite ante CFE</h2>
          <p>
            La gestión de interconexión ante la Comisión Federal de Electricidad (CFE)
            está sujeta a los <strong>procesos, requisitos y tiempos de la propia
            CFE</strong>. Jygasoft Energy acompaña y gestiona el trámite, pero no
            controla ni garantiza los plazos de resolución, estudios o la aprobación de
            la autoridad.
          </p>

          <h2>5. Veracidad de la información del usuario</h2>
          <p>
            Eres responsable de la veracidad y exactitud de los datos que proporcionas.
            La información incorrecta puede afectar las estimaciones, la cotización o la
            viabilidad del proyecto.
          </p>

          <h2>6. Propiedad intelectual</h2>
          <p>
            Los contenidos del Sitio (textos, gráficos, logotipos, marcas, imágenes,
            código y su selección y disposición) son propiedad de Jygasoft Energy o de
            sus titulares y están protegidos por la legislación aplicable. Queda
            prohibida su reproducción, distribución o explotación sin autorización
            previa y por escrito.
          </p>

          <h2>7. Uso aceptable</h2>
          <p>Al usar el Sitio, te obligas a no:</p>
          <ul>
            <li>Utilizarlo con fines ilícitos o contrarios a estos Términos.</li>
            <li>Intentar vulnerar su seguridad, integridad o disponibilidad.</li>
            <li>Enviar información falsa, spam o contenido malicioso.</li>
            <li>Realizar accesos automatizados no autorizados (scraping, bots).</li>
          </ul>

          <h2>8. Enlaces y servicios de terceros</h2>
          <p>
            El Sitio puede contener enlaces o integraciones de terceros (por ejemplo,
            WhatsApp y plataformas de medición publicitaria). Jygasoft Energy no es
            responsable del contenido ni de las prácticas de privacidad de dichos
            terceros, que se rigen por sus propios términos.
          </p>

          <h2>9. Disponibilidad del Sitio</h2>
          <p>
            Procuramos mantener el Sitio disponible y actualizado, pero no garantizamos
            su funcionamiento ininterrumpido ni libre de errores. Podemos suspender,
            modificar o descontinuar total o parcialmente el Sitio sin responsabilidad.
          </p>

          <h2>10. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por la ley, Jygasoft Energy no será
            responsable por daños indirectos, incidentales o consecuentes derivados del
            uso del Sitio o de las estimaciones, ni por decisiones tomadas únicamente con
            base en la información referencial aquí publicada. Las obligaciones y
            garantías de los servicios se rigen por el contrato que, en su caso, firmes.
          </p>

          <h2>11. Garantías de los sistemas</h2>
          <p>
            Las garantías de equipos (por ejemplo, paneles e inversores) son otorgadas
            por sus fabricantes conforme a sus términos. Las garantías de instalación y
            servicio se establecen en el contrato correspondiente.
          </p>

          <h2>12. Privacidad</h2>
          <p>
            El tratamiento de tus datos personales se rige por nuestro{" "}
            <a href="/legal/aviso-privacidad">Aviso de Privacidad</a>, que forma parte
            integral de estos Términos.
          </p>

          <h2>13. Modificaciones</h2>
          <p>
            Podemos actualizar estos Términos en cualquier momento. La versión vigente
            será la publicada en esta página, con su fecha de última actualización. El
            uso continuado del Sitio implica la aceptación de los cambios.
          </p>

          <h2>14. Legislación aplicable y jurisdicción</h2>
          <p>
            Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para
            cualquier controversia, las partes se someten a los tribunales competentes de
            Aguascalientes, Aguascalientes, renunciando a cualquier otro fuero que
            pudiera corresponderles.
          </p>

          <h2>15. Contacto</h2>
          <p>
            Para dudas sobre estos Términos, escríbenos a{" "}
            <a href="mailto:contacto@jygasoft.com">contacto@jygasoft.com</a>.
          </p>

          <hr />
          <p className="text-sm text-muted-foreground">
            Documento de carácter informativo y base. Debe ser revisado y validado por
            un asesor legal y completado con los datos formales del titular (denominación
            legal, domicilio y RFC) antes de su publicación definitiva.
          </p>
        </div>
      </article>
    </main>
  );
}
