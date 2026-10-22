import type { Metadata } from "next";
import Legal from "../legal";

export const metadata: Metadata = { title: "Términos y condiciones · Creads IA", description: "Las reglas para usar Creads IA: cuentas, créditos, pagos y uso del contenido." };

export default function Terminos() {
  return (
    <Legal title="Términos y condiciones" updated="16 de octubre de 2026">
      <p>Estos términos regulan el uso de Creads IA («Creads»), disponible en creadsia.com. Al crear una cuenta o usar la plataforma aceptas estos términos y la <a href="/privacidad" className="underline">Política de privacidad</a>. Contacto: <b>hola@creadsia.com</b>.</p>

      <h2>1. El servicio</h2>
      <p>Creads es un estudio que reúne distintos modelos de inteligencia artificial de terceros para crear anuncios, videos, imágenes, voces y otros contenidos a partir de tus instrucciones. Los modelos disponibles pueden cambiar con el tiempo.</p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Debes ser mayor de 18 años y dar datos verdaderos.</li>
        <li>Eres responsable de cuidar tu clave y de lo que se haga desde tu cuenta. Te recomendamos activar la verificación en dos pasos.</li>
        <li>Podemos suspender cuentas que incumplan estos términos o pongan en riesgo la plataforma o a otras personas.</li>
      </ul>

      <h2>3. Planes y créditos</h2>
      <ul>
        <li>Cada trabajo (video, imagen, voz u otro) usa créditos según el modelo y su duración. Siempre ves el precio antes de generar.</li>
        <li>Los planes entregan créditos para cada período pagado (un mes, o un año en el plan anual). Los créditos se usan dentro de ese período: los que no uses vencen cuando termina y no se acumulan para el siguiente. Las recargas se suman a tu saldo y vencen junto con tu plan.</li>
        <li>Si un trabajo falla por un problema del proveedor o de la plataforma, sus créditos vuelven automáticamente a tu cuenta.</li>
        <li>Los créditos no son dinero, no se pueden transferir a otras cuentas ni canjear por efectivo.</li>
      </ul>

      <h2>4. Pagos, renovación y cancelación</h2>
      <ul>
        <li>Los precios se muestran en dólares de EE. UU. (US$) e incluyen los impuestos que correspondan. Los pagos se procesan con Mercado Pago, que cobra el equivalente en pesos chilenos al tipo de cambio del día; antes de pagar ves el monto exacto en pesos.</li>
        <li>Los planes mensuales con renovación automática se cobran cada mes hasta que canceles. Puedes cancelar la renovación en cualquier momento desde «Planes y créditos»; tu plan sigue activo hasta la fecha pagada.</li>
        <li>La oferta de lanzamiento (primer mes del plan Emprende mensual a US$29) aplica una vez por cuenta. Desde el segundo mes se cobra el precio normal del plan.</li>
        <li>Los planes anuales y las recargas se pagan una sola vez.</li>
        <li><b>Derecho a retracto:</b> conforme al artículo 3 bis de la Ley 19.496, te informamos antes de pagar que en la compra de planes y recargas no aplica el derecho a retracto, porque el servicio es digital y se entrega de inmediato: los créditos quedan disponibles apenas se confirma el pago. Aun así, si no has usado ningún crédito de esa compra y nos escribes dentro de los 10 días siguientes, te devolvemos el pago.</li>
        <li>Si tienes un problema con un cobro, escríbenos a hola@creadsia.com antes de reclamar en Mercado Pago, y lo resolvemos. Si un pago se devuelve o se desconoce, descontamos los créditos que ese pago entregó. Esto no limita los derechos que te da la Ley 19.496 sobre protección de los derechos de los consumidores.</li>
      </ul>

      <h2>5. Tu contenido</h2>
      <ul>
        <li>El contenido que subes sigue siendo tuyo. Nos das permiso para procesarlo solo para darte el servicio.</li>
        <li>El contenido que generas en Creads es tuyo y puedes usarlo comercialmente, sujeto a estos términos y a las condiciones de los modelos que lo generaron.</li>
        <li>Guardamos tus videos, imágenes y audios mientras tengas tu cuenta. Si tu plan lleva más de 6 meses vencido, podemos borrar los archivos generados, avisándote por correo con al menos 15 días de anticipación para que descargues lo que quieras conservar.</li>
        <li>La IA puede equivocarse: revisa siempre el contenido antes de publicarlo. Eres responsable de lo que publicas y de cumplir las reglas de las plataformas donde lo publiques (por ejemplo, Meta y TikTok).</li>
      </ul>

      <h2>6. Uso permitido</h2>
      <p>No puedes usar Creads para:</p>
      <ul>
        <li>Usar la cara, la voz o la identidad de una persona sin su autorización, ni hacerte pasar por otra persona o empresa.</li>
        <li>Crear contenido sexual de menores, contenido sexual no consentido, violencia, odio, acoso o contenido ilegal.</li>
        <li>Engañar a consumidores con afirmaciones falsas, testimonios inventados presentados como reales o promesas de salud o dinero que no puedas respaldar.</li>
        <li>Infringir derechos de autor, marcas u otros derechos de terceros.</li>
        <li>Intentar vulnerar la seguridad de la plataforma, abusar de ella con cuentas falsas o automatizaciones no autorizadas, o revender el acceso.</li>
      </ul>
      <p>Si detectamos un uso prohibido podemos detener la generación, suspender la cuenta sin devolver los créditos ya usados y, cuando la ley lo exija, informar a las autoridades. Por seguridad, las cuentas nuevas tienen un límite diario de uso durante sus primeros dos días.</p>

      <h2>7. Disponibilidad y responsabilidad</h2>
      <p>Trabajamos para que Creads funcione siempre y con la mejor calidad, pero dependemos de proveedores externos y no podemos garantizar que el servicio esté libre de interrupciones o errores. En la medida que lo permita la ley, nuestra responsabilidad total frente a ti se limita a lo que pagaste en los últimos tres meses.</p>

      <h2>8. Cambios</h2>
      <p>Podemos actualizar estos términos. Publicaremos la nueva versión aquí con su fecha y, si el cambio es importante, te avisaremos con anticipación.</p>

      <h2>9. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de Chile.</p>
    </Legal>
  );
}
