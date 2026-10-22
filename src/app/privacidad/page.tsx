import type { Metadata } from "next";
import Legal from "../legal";

export const metadata: Metadata = { title: "Política de privacidad · Creads IA", description: "Qué datos usa Creads IA, para qué y cómo ejercer tus derechos." };

export default function Privacidad() {
  return (
    <Legal title="Política de privacidad" updated="22 de octubre de 2026">
      <p>Creads IA («Creads», «nosotros») es una plataforma para crear anuncios, videos, imágenes y voces con inteligencia artificial, disponible en creadsia.com. Esta política explica qué datos personales usamos, para qué, con quién los compartimos y cómo puedes ejercer tus derechos, conforme a la ley chilena de protección de datos personales (Ley 19.628 y sus modificaciones, incluida la Ley 21.719).</p>
      <p>Responsable: Creads IA. Contacto para privacidad: <b>hola@creadsia.com</b>.</p>

      <h2>1. Qué datos usamos</h2>
      <ul>
        <li><b>Cuenta:</b> nombre, correo, empresa o marca (si la indicas) y tu clave, que guardamos cifrada; nunca la vemos.</li>
        <li><b>Pagos:</b> el plan o recarga que compras, el monto y el estado del pago. El pago lo procesa Mercado Pago: Creads no ve ni guarda los datos de tu tarjeta.</li>
        <li><b>Contenido que subes o creas:</b> guiones, fotos de personas y productos, audios y voces, videos e imágenes generados.</li>
        <li><b>Uso de la plataforma:</b> trabajos realizados, créditos usados, registros técnicos de seguridad (por ejemplo, dirección IP e intentos de ingreso).</li>
        <li><b>Consultas al Asistente Creads:</b> tus mensajes se procesan con IA para responderte (junto con el estado de tu plan, créditos y últimos trabajos). Guardamos el tema y un resumen corto de cada pregunta para mejorar el Centro de ayuda.</li>
        <li><b>Medición publicitaria:</b> solo si aceptas las cookies de medición, usamos el píxel y la API de conversiones de Meta para saber qué anuncios nos traen visitas y compras. Tu correo se envía cifrado (hash) y nunca en texto. Con esa misma aceptación, RedTrack registra de qué anuncio llegaste y si te registraste o compraste (sin tu correo). También usamos PostHog, solo con esa misma aceptación, para ver cómo se usa el sitio (páginas, clics y grabaciones de la pantalla en las que todo lo que escribes queda tapado; si inicias sesión, se asocian a tu cuenta para poder ayudarte) y así arreglar lo que confunde o falla.</li>
      </ul>

      <h2>2. Para qué los usamos</h2>
      <ul>
        <li>Darte el servicio: crear tu cuenta, generar tu contenido, guardarlo en tu biblioteca y cobrar los créditos.</li>
        <li>Procesar pagos, renovaciones y comprobantes.</li>
        <li>Proteger la plataforma y a los usuarios: evitar fraudes, abusos y accesos no autorizados.</li>
        <li>Mejorar la calidad: la revisión automática compara cada video con su guion. Los aprendizajes que se aplican a todos los usuarios son reglas generales, nunca tu contenido.</li>
        <li>Medir nuestras campañas, solo con tu consentimiento.</li>
        <li>Responder tus consultas (también con el Asistente Creads, con IA) y avisarte cambios importantes del servicio.</li>
        <li>Enviarte consejos para usar la plataforma durante tu primera semana. Puedes dejar de recibirlos con un clic en el enlace del correo.</li>
      </ul>

      <h2>3. Caras y voces de personas</h2>
      <p>Para usar la cara o la voz de una persona (incluida la tuya) debes tener su autorización, y la plataforma te pide confirmarlo. Usamos esas fotos y audios solo para generar el contenido que tú pides. No los usamos para entrenar modelos ni los compartimos con otros usuarios.</p>

      <h2>4. Con quién compartimos datos</h2>
      <p>Solo con proveedores que necesitamos para darte el servicio, y solo lo necesario:</p>
      <ul>
        <li><b>Infraestructura:</b> Vercel (sitio y servidores) y Supabase (base de datos y archivos privados).</li>
        <li><b>Modelos de IA:</b> fal.ai (video con MiniMax y labios), Google (imágenes con Nano Banana), ElevenLabs (voces y transcripción) y Anthropic (Claude: guiones, el asistente y la revisión de cada anuncio), que procesan tu contenido para generarlo. Para la función «Espiar anuncios» consultamos la biblioteca pública de anuncios de Meta a través de Scrape Creators (no envía tus datos). Para revisar internamente cómo funciona el servicio usamos además xAI (Grok), solo con resúmenes de los que quitamos correos, teléfonos y otros datos que te identifiquen.</li>
        <li><b>Pagos:</b> Mercado Pago.</li>
        <li><b>Correos:</b> Resend, que envía los correos de la cuenta (bienvenida, comprobantes de pago, cambio de clave, avisos de tu plan y de tu saldo).</li>
        <li><b>Medición:</b> Meta, RedTrack y PostHog, solo si aceptas las cookies de medición.</li>
      </ul>
      <p>Algunos de estos proveedores procesan datos fuera de Chile. Elegimos proveedores con medidas de seguridad adecuadas. No vendemos tus datos.</p>

      <h2>5. Cuánto tiempo los guardamos</h2>
      <p>Mientras tengas tu cuenta. Si la cierras, borramos tu contenido y tus datos en un plazo razonable, salvo lo que debamos guardar por obligaciones legales o tributarias (por ejemplo, registros de pagos).</p>

      <p><b>Apps conectadas.</b> Si conectas Creads a una aplicación de IA (por ejemplo Claude o ChatGPT) o a otro sistema con una clave de API, esa aplicación recibe lo que le pides a Creads desde ella: enlaces a las imágenes y videos, el avance de tus anuncios y tu saldo de créditos. Lo que escribes en esa aplicación lo trata ella según su propia política de privacidad. Creads guarda solo la clave de la conexión (cifrada) y el registro de lo que se generó con tu cuenta; no recibe tus conversaciones. Puedes cortar la conexión cuando quieras en «API y conector».</p>

      <h2>6. Seguridad</h2>
      <p>Tus archivos se guardan en almacenamiento privado, separado por cuenta, y se entregan con enlaces temporales. Las claves se guardan cifradas, puedes activar la verificación en dos pasos y limitamos los intentos de ingreso. Ningún sistema es infalible: si detectamos un incidente que te afecte, te avisaremos.</p>

      <h2 id="derechos">7. Tus derechos</h2>
      <p>Puedes pedir acceso, rectificación, supresión, oposición y portabilidad de tus datos, y retirar tu consentimiento a la medición publicitaria cuando quieras (borrando las cookies o escribiéndonos). Escríbenos a <b>hola@creadsia.com</b> desde el correo de tu cuenta y te respondemos en los plazos que fija la ley.</p>

      <h2>8. Cookies</h2>
      <p>Usamos cookies necesarias para que funcione la plataforma (por ejemplo, para mantener tu sesión). Las cookies de medición de Meta, RedTrack y PostHog solo se activan si las aceptas en el aviso de cookies.</p>
      <p>Además contamos las visitas de forma anónima y agregada (cuántas visitas hubo cada día, desde qué tipo de dispositivo, ciudad y canal), sin guardar tu IP ni nada que te identifique. Si aceptas las cookies, una cookie propia recuerda además solo el canal por el que llegaste (por ejemplo, «instagram») durante 90 días, para saber qué canales nos traen clientes.</p>

      <h2>9. Cambios</h2>
      <p>Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha y, si el cambio es importante, te avisaremos.</p>
    </Legal>
  );
}
