import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Aviso de Privacidad",
  description:
    "Aviso de Privacidad Integral de Jygasoft Energy conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).",
  alternates: { canonical: "/legal/aviso-privacidad" },
  robots: { index: true, follow: true },
};

const ACTUALIZACION = "20 de junio de 2026";

export default function AvisoPrivacidad() {
  return (
    <main>
      {/* Cabecera con banner de marca */}
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
            Aviso de Privacidad Integral
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
            En cumplimiento de la <strong>Ley Federal de Protección de Datos
            Personales en Posesión de los Particulares (LFPDPPP)</strong>, su
            Reglamento y los Lineamientos del Aviso de Privacidad,{" "}
            <strong>Jygasoft Energy</strong> pone a tu disposición el presente Aviso
            de Privacidad Integral, que describe cómo tratamos y protegemos tus datos
            personales.
          </p>

          <h2>1. Identidad y domicilio del Responsable</h2>
          <p>
            <strong>Jygasoft Energy</strong> (el “Responsable”), con domicilio en
            Aguascalientes, Aguascalientes, México (domicilio fiscal a confirmar), es
            responsable del tratamiento de tus datos personales. Para cualquier asunto
            relacionado con tus datos, puedes contactar a nuestro Departamento de Datos
            Personales en{" "}
            <a href="mailto:privacidad@jygasoft.com">privacidad@jygasoft.com</a>.
          </p>

          <h2>2. Datos personales que recabamos</h2>
          <p>
            Para las finalidades descritas en este aviso, podemos recabar las
            siguientes categorías de datos:
          </p>
          <ul>
            <li>
              <strong>Identificación y contacto:</strong> nombre, teléfono/WhatsApp,
              correo electrónico.
            </li>
            <li>
              <strong>Ubicación:</strong> código postal, colonia, municipio, estado y,
              en su caso, domicilio de la instalación.
            </li>
            <li>
              <strong>Consumo y servicio eléctrico:</strong> monto del recibo de CFE,
              consumo en kWh, número de servicio (RMU), tarifa, esquema y datos de
              titularidad del servicio; imagen del recibo si la proporcionas.
            </li>
            <li>
              <strong>Datos fiscales</strong> (solo si contratas): RFC, régimen fiscal y
              Constancia de Situación Fiscal, para efectos de facturación.
            </li>
            <li>
              <strong>Datos técnicos de navegación:</strong> dirección IP, tipo de
              navegador, páginas visitadas y parámetros de campaña (UTM), recabados de
              forma automática (ver sección 8).
            </li>
            <li>
              <strong>Evidencias del proyecto:</strong> fotografías del inmueble o de la
              instalación, cuando aplique a la prestación del servicio.
            </li>
          </ul>
          <p>
            <strong>No recabamos datos personales sensibles</strong> (como origen
            racial, estado de salud, creencias, etc.). Te pedimos no proporcionarlos.
          </p>

          <h2>3. Forma de obtención de los datos</h2>
          <p>Obtenemos tus datos por las siguientes vías:</p>
          <ul>
            <li>
              <strong>Directa:</strong> cuando completas nuestros formularios
              (calculadora, contacto, cotización), nos escribes por WhatsApp o nos
              contactas por teléfono o correo.
            </li>
            <li>
              <strong>Automática:</strong> mediante cookies y tecnologías de rastreo al
              navegar nuestro sitio.
            </li>
            <li>
              <strong>De terceros:</strong> plataformas de publicidad y campañas
              digitales que nos refieren prospectos, conforme a sus propias políticas.
            </li>
          </ul>

          <h2>4. Finalidades primarias (necesarias)</h2>
          <p>
            Tratamos tus datos para las siguientes finalidades necesarias para
            originar, mantener y cumplir la relación con el Responsable:
          </p>
          <ul>
            <li>Atender tus solicitudes y darte seguimiento como prospecto o cliente.</li>
            <li>Calcular tu ahorro estimado y elaborar tu cotización.</li>
            <li>Realizar el levantamiento técnico y el diseño del sistema.</li>
            <li>Gestionar el trámite de interconexión ante CFE.</li>
            <li>Ejecutar la instalación, puesta en operación y postventa/garantía.</li>
            <li>Facturación, cobranza y cumplimiento de obligaciones fiscales y legales.</li>
          </ul>

          <h2>5. Finalidades secundarias (no necesarias)</h2>
          <p>
            De manera adicional, y siempre que no te opongas, podemos usar tus datos
            para:
          </p>
          <ul>
            <li>Envío de promociones, novedades y contenido informativo.</li>
            <li>Prospección comercial y encuestas de satisfacción.</li>
            <li>Análisis estadístico y mejora de nuestros servicios.</li>
          </ul>
          <p>
            <strong>Puedes negarte a estas finalidades</strong> sin que ello afecte la
            prestación del servicio, dejando sin marcar la casilla de consentimiento de
            marketing en nuestros formularios, o enviando un correo a{" "}
            <a href="mailto:privacidad@jygasoft.com">privacidad@jygasoft.com</a> con el
            asunto “Baja de finalidades secundarias”.
          </p>

          <h2>6. Transferencias y encargados del tratamiento</h2>
          <p>
            Para cumplir las finalidades anteriores, tus datos pueden ser tratados por{" "}
            <strong>encargados</strong> que actúan por cuenta del Responsable, entre
            ellos: proveedores de hospedaje y nube, herramientas de automatización de
            flujos (n8n), nuestro sistema de gestión (CRM) y plataformas de medición
            publicitaria (Meta). Estos encargados solo tratan los datos conforme a
            nuestras instrucciones y para las finalidades aquí descritas.
          </p>
          <p>
            Asimismo, podemos realizar <strong>transferencias</strong> sin requerir tu
            consentimiento en los casos previstos por el artículo aplicable de la
            LFPDPPP, por ejemplo:
          </p>
          <ul>
            <li>
              A la <strong>Comisión Federal de Electricidad (CFE)</strong>, cuando sea
              necesario para gestionar tu trámite de interconexión.
            </li>
            <li>A autoridades competentes cuando exista requerimiento legal.</li>
            <li>A terceros derivado de una relación jurídica necesaria para el servicio.</li>
          </ul>
          <p>
            Cualquier transferencia distinta a las anteriores que requiera tu
            consentimiento te será informada para recabarlo previamente.
          </p>

          <h2>7. Medidas de seguridad</h2>
          <p>
            Implementamos medidas de seguridad administrativas, técnicas y físicas
            razonables para proteger tus datos contra daño, pérdida, alteración,
            destrucción o uso, acceso o tratamiento no autorizado, incluyendo control de
            accesos, cifrado de comunicaciones, segregación de credenciales y registros
            de actividad.
          </p>

          <h2>8. Cookies y tecnologías de rastreo</h2>
          <p>
            Nuestro sitio utiliza cookies y tecnologías similares (como el Píxel de
            Meta) para medir el desempeño de nuestra publicidad y mejorar tu
            experiencia. Estas tecnologías pueden recabar tu dirección IP, tipo de
            navegador, páginas visitadas y parámetros de campaña.
          </p>
          <p>
            El uso de estas tecnologías está <strong>gobernado por tu
            consentimiento</strong>: al ingresar verás un aviso para aceptarlas o
            rechazarlas. También puedes deshabilitar las cookies desde la configuración
            de tu navegador.
          </p>

          <h2>9. Derechos ARCO y revocación del consentimiento</h2>
          <p>
            Tienes derecho a <strong>Acceder</strong> a tus datos, solicitar su{" "}
            <strong>Rectificación</strong> cuando sean inexactos, su{" "}
            <strong>Cancelación</strong> cuando consideres que no se requieren, u{" "}
            <strong>Oponerte</strong> a su tratamiento (derechos ARCO), así como{" "}
            <strong>revocar</strong> el consentimiento que nos hayas otorgado.
          </p>
          <p>
            Para ejercerlos, envía tu solicitud a{" "}
            <a href="mailto:privacidad@jygasoft.com">privacidad@jygasoft.com</a>,
            incluyendo:
          </p>
          <ul>
            <li>Tu nombre y un medio para comunicarte la respuesta.</li>
            <li>Copia de una identificación oficial que acredite tu identidad.</li>
            <li>Descripción clara de los datos y del derecho que deseas ejercer.</li>
            <li>Cualquier elemento que facilite la localización de tus datos.</li>
          </ul>
          <p>
            Daremos respuesta a tu solicitud en los plazos que establece la ley. La
            revocación del consentimiento o el ejercicio de algunos derechos podría
            implicar que no podamos continuar prestando el servicio.
          </p>

          <h2>10. Limitación del uso o divulgación</h2>
          <p>
            Puedes limitar el uso o divulgación de tus datos enviando tu solicitud al
            correo de privacidad. Adicionalmente, puedes inscribir tu número en el
            Registro Público para Evitar Publicidad (REPEP) de la PROFECO para no recibir
            publicidad.
          </p>

          <h2>11. Conservación de los datos</h2>
          <p>
            Conservamos tus datos durante el tiempo necesario para cumplir las
            finalidades descritas y los plazos legales aplicables (por ejemplo,
            obligaciones fiscales y vigencia de garantías del sistema). Concluidos
            dichos plazos, los datos se bloquean y se suprimen conforme a la normativa.
          </p>

          <h2>12. Cambios al Aviso de Privacidad</h2>
          <p>
            Este aviso puede actualizarse para reflejar cambios legales, internos o en
            nuestras prácticas. Las modificaciones estarán disponibles en esta misma
            página, indicando la fecha de última actualización.
          </p>

          <h2>13. Autoridad competente</h2>
          <p>
            Si consideras que tu derecho a la protección de datos personales ha sido
            vulnerado, puedes acudir ante la autoridad competente en materia de
            protección de datos personales en México.
          </p>

          <h2>14. Consentimiento</h2>
          <p>
            Al proporcionarnos tus datos personales a través de nuestros formularios,
            WhatsApp u otros medios, y al utilizar nuestro sitio, manifiestas que has
            leído y aceptas el presente Aviso de Privacidad.
          </p>

          <hr />
          <p className="text-sm text-muted-foreground">
            Documento de carácter informativo y base. Debe ser revisado y validado por
            un asesor legal y completado con los datos formales del Responsable
            (denominación legal, domicilio fiscal y RFC) antes de su publicación
            definitiva.
          </p>
        </div>
      </article>
    </main>
  );
}
