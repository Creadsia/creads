import type { Metadata } from "next";
import Legal from "../../legal";
import { PROGRAMA as P } from "@/lib/afiliados-calc";

export const metadata: Metadata = {
  title: "Términos del programa de afiliados · Creads IA",
  description: "Las reglas del programa de afiliados de Creads IA: comisiones, pagos, prohibiciones y cierre de cuentas.",
  alternates: { canonical: "/afiliados/terminos" },
};

export default function TerminosAfiliados() {
  return (
    <Legal title="Términos del programa de afiliados" updated="25 de octubre de 2026">
      <p>Estos términos regulan el programa de afiliados de Creads IA («Creads»). Se suman a los <a href="/terminos" className="underline">Términos y condiciones</a> y a la <a href="/privacidad" className="underline">Política de privacidad</a> de Creads. Al postular aceptas estos términos. Contacto: <b>hola@creadsia.com</b>.</p>

      <h2>1. Quién puede participar</h2>
      <ul>
        <li>Personas mayores de 18 años o empresas, con una cuenta de Creads, que postulen desde su panel y sean aprobadas por Creads.</li>
        <li>Creads puede aprobar o rechazar postulaciones según su criterio, por ejemplo si el canal no calza con el producto.</li>
      </ul>

      <h2>2. Cómo se asocia un cliente a ti</h2>
      <ul>
        <li>Tienes un enlace propio (por ejemplo, creadsia.com/?ref=TUCODIGO) y un código.</li>
        <li>Cuando alguien entra por tu enlace, guardamos tu código en su navegador durante {P.cookieDias} días. Si después entra por el enlace de otro afiliado, cuenta el último enlace (último clic).</li>
        <li>La persona también puede escribir tu código al crear su cuenta; en ese caso cuenta el código escrito.</li>
        <li>El cliente queda asociado a ti cuando crea su cuenta en Creads. Una cuenta ya asociada a un afiliado no cambia de afiliado, y las cuentas creadas antes de entrar por tu enlace no se asocian.</li>
      </ul>

      <h2>3. Comisiones</h2>
      <ul>
        <li>Ganas el <b>{P.pctTramo1}%</b> de lo que el cliente paga a Creads (planes y recargas) en sus meses 1 a {P.mesesTramo1}, y el <b>{P.pctTramo2}%</b> en sus meses {P.mesesTramo1 + 1} a {P.maxMeses}. Desde el mes {P.maxMeses + 1} de ese cliente no hay comisión.</li>
        <li>Los meses del cliente se cuentan por los meses calendario en que pagó, empezando por su primer pago. Un plan anual se reparte en partes iguales en los 12 meses que cubre, cada uno con su porcentaje.</li>
        <li>Los pagos en pesos chilenos se convierten a dólares de EE. UU. al tipo de cambio del día del pago. La comisión se calcula sobre el monto cobrado.</li>
        <li>Solo cuentan los pagos efectivamente recibidos por Creads. Los créditos de regalo y las pruebas gratis no generan comisión; si el cliente paga con descuento, la comisión se calcula sobre lo que pagó.</li>
        <li>Si el programa está pausado para tu cuenta, los pagos de ese período no generan comisión.</li>
      </ul>

      <h2>4. Reembolsos y contracargos</h2>
      <ul>
        <li>Si un pago se reembolsa, se desconoce o tiene un contracargo, la comisión de ese pago se anula.</li>
        <li>Si esa comisión ya te fue pagada, el monto se descuenta de tus próximos pagos.</li>
      </ul>

      <h2>5. Pagos</h2>
      <ul>
        <li>Cada comisión queda disponible {P.retencionDias} días después del pago del cliente (para cubrir reembolsos).</li>
        <li>Pagamos una vez al mes el saldo disponible, siempre que sea de al menos <b>US${P.minimoUsd}</b>. Si no llega, se acumula para el mes siguiente.</li>
        <li>Pagamos por PayPal, Wise o transferencia bancaria, con los datos que completes en tu panel. Eres responsable de que estén correctos. Las comisiones que cobre tu medio de pago corren por tu cuenta.</li>
        <li>Eres responsable de declarar y pagar tus impuestos. Creads puede pedirte una boleta, factura o documento equivalente antes de pagar.</li>
      </ul>

      <h2>6. Lo que no puedes hacer</h2>
      <ul>
        <li><b>Pujar por la marca:</b> no puedes comprar anuncios en buscadores (Google, Bing u otros) con las palabras «Creads», «Creads IA», «creadsia» ni variantes o errores de escritura, ni usar la marca en el nombre de tus cuentas, dominios o perfiles de forma que parezcan oficiales de Creads.</li>
        <li><b>Spam:</b> no puedes enviar correos, mensajes o comentarios masivos no solicitados, ni publicar tu enlace en lugares donde no está permitido.</li>
        <li><b>Autorreferidos:</b> no puedes usar tu enlace o tu código para tus propias compras, las de tu empresa o cuentas que controles. Las compras de tu propia cuenta o con tu mismo correo no generan comisión.</li>
        <li><b>Promesas de ingresos:</b> no puedes prometer ganancias, resultados de ventas ni ingresos a quienes recomiendas, ni presentar el programa de afiliados como una oportunidad de inversión.</li>
        <li>No puedes ofrecer descuentos, regalos o reembolsos en nombre de Creads, ni hacer afirmaciones falsas sobre el producto.</li>
        <li>No puedes usar métodos engañosos para conseguir clics o registros (cookies forzadas, ventanas emergentes, tráfico incentivado o automatizado).</li>
      </ul>

      <h2>7. Cierre de cuentas</h2>
      <ul>
        <li>Creads puede pausar o cerrar tu cuenta de afiliado si no cumples estos términos. En ese caso, las comisiones generadas por el incumplimiento se anulan y no se pagan.</li>
        <li>Puedes dejar el programa cuando quieras escribiendo a hola@creadsia.com. Si te vas sin haber incumplido estos términos, te pagamos el saldo disponible que llegue al mínimo.</li>
        <li>Creads puede cambiar estos términos o terminar el programa avisándote por correo con al menos 30 días de anticipación. Las comisiones ya generadas se respetan según las reglas vigentes cuando se generaron.</li>
      </ul>

      <h2>8. Otros</h2>
      <ul>
        <li>Ser afiliado no te convierte en empleado, socio ni representante de Creads.</li>
        <li>Puedes usar el nombre y el logo de Creads solo para recomendar el producto, sin alterarlos.</li>
        <li>Estos términos se rigen por las leyes de Chile.</li>
      </ul>
    </Legal>
  );
}
