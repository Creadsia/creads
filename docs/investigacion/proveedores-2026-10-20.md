# Proveedores directos para dejar fal.ai: investigación del 20-oct-2026

Precios revisados el **20 de octubre de 2026**. Todos en US$ por segundo de video a 720p, salvo que diga otra cosa. «Hoy (fal)» es lo que Creads paga según `src/lib/providers/fal.ts`, `src/lib/providers/tools.ts` y `src/lib/finance.ts`.
Ya resueltos y fuera de esta tabla: Veo 3.1 (Vertex), Seedance (BytePlus), Nano Banana Pro para generar (Gemini) y las voces (ElevenLabs).

No se creó ninguna cuenta, no se gastó plata y no se ingresó ninguna clave.

## Resumen en 5 líneas

1. **Salir de fal ahorra menos de lo esperado en varios modelos.** Kling, Hailuo, Wan, Grok y FLUX cuestan casi lo mismo en fal que con su dueño. Donde sí se ahorra harto es en lo de ByteDance (Seedance, Seedream, OmniHuman), en Nano Banana vía Gemini y en el mejorador de video.
2. **El ahorro grande en Kling se logra comprando directo a Kling en paquetes prepagados** (entre 10 % y 37 % menos), pero los paquetes vencen en 30 a 180 días.
3. **Higgsfield cobra por Kling 3.0 menos de lo que Kling le cobra a cualquier desarrollador** (unos US$0,05–0,07 por segundo, contra US$0,126 de la API oficial). Ahí no se puede competir solo cambiando de proveedor: Higgsfield tiene un acuerdo especial o pierde plata en ese modelo a propósito.
4. **El problema más grande no es el proveedor: es cuántos créditos cobra Creads.** Con los créditos de hoy, Creads le sale al cliente entre 3 y 9 veces más caro que Higgsfield en Kling, Veo, Seedance y Nano Banana (ver tabla de Higgsfield).
5. Hay modelos nuevos muy baratos que vale la pena probar: **Grok Imagine Video 1.5 Lite** (US$0,03/s con audio), **Nano Banana 2.1** (US$0,034 por imagen), **Seedream 5 Flash** (US$0,018 por imagen) y **MiniMax H3** (US$0,08/s con audio).

## 1. Tabla principal

| Modelo | Hoy (fal) | Mejor opción directa | Precio | Ahorro | ¿Confiable? | Fuente |
|---|---|---|---|---|---|---|
| Kling 3.0 (720p con audio) | 0,14 | API oficial de Kling (paquetes prepagados) | 0,126 (paquetes de US$700 o más) · 0,088 (paquetes de prueba de US$9,80 y US$98) | 10 % – 37 % | Sí, es el dueño. Ojo: los paquetes vencen (30 días los de prueba, 180 los grandes) | [Atlas Cloud, tabla de paquetes oficiales](https://www.atlascloud.ai/blog/guides/kling-ai-api-pricing), [SeedRouter, 6-oct](https://seedrouter.ai/blog/kling-3-0-api-pricing), [Vidirect, 1-oct](https://vidirect.org/tools/kling/pricing) |
| Kling 3.0 (alternativa sin prepago) | 0,14 | Runware (Kling 3.0 Omni Standard) | 0,112 | 20 % | Empresa seria, pago según uso. No confirmado que sea socio oficial de Kling | [AIReiter, 27-sep](https://aireiter.com/blog/cheapest-image-to-video-api) |
| Kling 3.0 Pro (1080p con audio) | 0,168 | API oficial de Kling | 0,168 (paquete grande) · 0,118 (paquete de prueba) | 0 % – 30 % | Sí | Mismas fuentes de Kling |
| Kling 3.0 Turbo | 0,14 (sin audio) | API oficial de Kling | 0,112 a 720p, con audio | 20 % | Sí | [Vidirect](https://vidirect.org/tools/kling/pricing) |
| Copiar movimiento (Kling Motion Control) | no confirmado (fal) | API oficial de Kling | 0,126 a 720p · 0,168 a 1080p | no confirmado | Sí | [Atlas Cloud](https://www.atlascloud.ai/blog/guides/kling-ai-api-pricing) |
| Editar video (Kling O1/Omni) | no confirmado (fal) | API oficial de Kling (Omni con video de entrada) | 0,126 a 720p | no confirmado | Sí | [Atlas Cloud](https://www.atlascloud.ai/blog/guides/kling-ai-api-pricing) |
| Sincronizar labios (Kling) | 0,014 | API oficial de Kling | no confirmado | no confirmado | — | Quedarse en fal (ya es barato) |
| Hailuo 2.3 (768p, 6 s) | 0,28 por clip (0,047/s) | MiniMax directo | 0,28 por clip | 0 % | Sí, es el dueño | [MiniMax, precios oficiales](https://platform.minimax.io/docs/pricing/overview) |
| Hailuo 2.3 Pro (1080p, 6 s) | 0,49 por clip | MiniMax directo | 0,49 por clip | 0 % | Sí | [MiniMax](https://platform.minimax.io/docs/pricing/overview) |
| Wan 3.0 (720p) | 0,10 | Alibaba Cloud Model Studio (Singapur) | 0,10 · región EE.UU. 0,083 (no confirmado en página oficial) | 0 % – 17 % | Sí, es el dueño. Límite 300 pedidos por minuto | [Alibaba, ficha wan3.0](https://www.alibabacloud.com/help/en/model-studio/wan3-0-video), [AIReiter](https://aireiter.com/blog/cheapest-image-to-video-api) |
| Grok Imagine Video 1.5 (720p) | 0,14 | xAI directo | 0,14 (audio incluido) | 0 % | Sí, es el dueño. 10 pedidos por segundo | [xAI docs](https://docs.x.ai/developers/models/grok-imagine-video-1.5), [x.ai/api/imagine](https://x.ai/api/imagine) |
| Nano Banana 2 (1K) | 0,08 por imagen | Gemini API (cuenta que ya tenemos) | 0,067 · en lote (no inmediato) 0,034 | 16 % | Sí, ya tenemos cuenta | [Google, precios Gemini API](https://ai.google.dev/gemini-api/docs/pricing) |
| Editar imagen / Crear personaje (Nano Banana Pro) | 0,15 por imagen | Gemini API (misma cuenta) | 0,134 | 11 % | Sí, ya tenemos cuenta | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Seedream 5 Pro (hasta 1,5K) | 0,0675 por imagen | BytePlus ModelArk (misma cuenta que Seedance) | 0,045 | 33 % | Sí, es el dueño. Sin mínimo publicado | [BytePlus, precios](https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing) |
| FLUX 3 (1K) | 0,048 por imagen | Black Forest Labs directo | 0,048 | 0 % | Sí, es el dueño | [BFL](https://docs.bfl.ml/quick_start/pricing), [Layer3, 16-oct](https://www.layer3labs.io/guides/flux-3-image-pricing) |
| FLUX 3 Klein (1K) | 0,009 por imagen | Black Forest Labs directo | 0,009 | 0 % | Sí | [BFL, Klein](https://docs.bfl.ml/flux_3/flux3_image_klein) |
| Avatar que habla (OmniHuman 2) | ~0,16 (aproximado) | BytePlus (OmniHuman 2.0 oficial) | 0,07 (hay otra tarifa de 0,12 para «avatar lip-sync»: confirmar cuál aplica) | ~56 % | Sí, es el dueño | [BytePlus OmniHuman](https://www.byteplus.com/en/product/OmniHuman) |
| Mejorar video a 1080p (SeedVR2) | 0,062 | WaveSpeed | 0,04 (mínimo 3 s por video) | 35 % | Agregador serio; SeedVR2 es un modelo abierto, no hay problema de licencia | [WaveSpeed SeedVR2](https://wavespeed.ai/hi/models/wavespeed-ai/seedvr2/video) |
| Mejorar imagen (SeedVR2) | ~0,02 | — | no confirmado | — | — | Quedarse en fal |
| Quitar fondo (Bria) | 0,03 en nuestra planilla | fal mismo publica 0,018 | 0,018 | — | — | [fal, julio 2026](https://fal.ai/learn/tools/best-background-remover-apis-2026). Revisar con la factura: puede que estemos sobreestimando el costo. Bria directo: no confirmado |
| «Mi personaje · Máxima calidad» (Genjutsu) | 0,35 (Comfy Router) | Solo existe dentro de Higgsfield | — | — | Es tecnología de Higgsfield; no hay API directa confirmada | — |

Para comparar, lo que ya está resuelto: Seedance 2.0 Fast / 2.0 / 2.5 en BytePlus cuesta **0,12 / 0,15 / 0,231** por segundo (en fal: 0,24 / 0,30 / 0,46), o sea **cerca de 50 % menos** ([BytePlus](https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing)).

### Pagos desde Chile y mínimos

- **Google (Gemini) y BytePlus**: tarjeta; Google ya funciona con saldo prepagado. BytePlus no publica un mínimo y suspende el servicio si el saldo queda negativo 2 horas.
- **Kling**: paquetes prepagados de US$9,80 a US$7.560. **Las unidades vencen** (30 días los de prueba, 180 días los grandes) y no se pueden extender. No hay pago según uso. No está confirmado si los paquetes de prueba se pueden volver a comprar. Si una generación falla, no se cobra.
- **MiniMax**: pago según uso, sin mínimo publicado. Los paquetes de video parten en US$1.000 al mes y no convienen.
- **Alibaba Cloud, xAI, Runware y WaveSpeed**: pago según uso con tarjeta. Falta confirmar al abrir cada cuenta si aceptan tarjetas chilenas; Runware regala US$2 a cuentas con correo de empresa.

## 2. Higgsfield frente a Creads

Planes de Higgsfield, confirmados hoy en la cuenta Ultra del dueño: Ultra cuesta **US$129 al mes, o US$99 al mes pagando el año, por 3.000 créditos**. Los créditos sueltos van de US$29,41 por 500 a US$210,53 por 4.000, y vencen en 90 días. Según [Wireflow (12-oct)](https://www.wireflow.ai/blog/higgsfield-ai-pricing), Starter cuesta US$19 por 270 créditos y Plus US$59 al mes (US$47 pagando el año) por 1.200.
Créditos que gasta cada modelo, según [Wireflow (12-oct)](https://www.wireflow.ai/blog/higgsfield-ai-pricing) y [Voyager (17-sep)](https://voyager.so/blog/higgsfield-pricing): Kling 3.0 a 720p, 5 s: ~7 · Seedance 2.0 a 720p, 5 s: ~22 · Seedance Fast: ~12–17 · Veo 3.1, 4 s: ~29–40 · Veo 3.1 Fast, 4 s: ~11–16 · Nano Banana Pro y Nano Banana 2: 2 por imagen · Wan 3.0 a 720p, 5 s: 8,75 · Hailuo 2.3 a 1080p, 6 s: ~10.

| Modelo | Precio por s para el cliente en Higgsfield (Ultra anual → Plus mensual) | Lo que pagaría Creads en la ruta más barata y confiable | Lo que cobra Creads hoy (créditos de `finance.ts`, a precio Ultra US$0,043 el crédito) |
|---|---|---|---|
| Kling 3.0 720p | 0,046 → 0,069 | 0,088–0,126 (Kling directo) | 10 créditos/s = **0,43** |
| Seedance 2.0 720p | 0,145 → 0,216 | 0,15 (BytePlus) | 18 créditos/s = **0,77** |
| Seedance 2.0 Fast | 0,08 → 0,17 | 0,12 (BytePlus) | 15 créditos/s = **0,65** |
| Veo 3.1 | 0,24–0,33 → 0,36–0,49 | 0,40 (Vertex) | 30 créditos/s = **1,29** |
| Veo 3.1 Fast | 0,09–0,13 → 0,13–0,20 | 0,15 (Vertex) | 10 créditos/s = **0,43** |
| Wan 3.0 720p | 0,058 → 0,086 | 0,10 (Alibaba) | 7 créditos/s = **0,30** |
| Nano Banana Pro (por imagen) | 0,066 → 0,098 | 0,134 (Gemini) | 8 créditos = **0,34** |
| Nano Banana 2 (por imagen) | 0,066 → 0,098 | 0,067 (Gemini) o 0,034 con Nano Banana 2.1 | 5 créditos = **0,22** |

Qué significa:
- En **Kling, Veo, Wan y Nano Banana Pro**, Higgsfield le cobra a su cliente **menos de lo que esos modelos le cuestan a cualquier desarrollador por API**. Eso se explica por descuentos por volumen, por subsidio a propósito o por la apuesta de que la gente no gaste todos sus créditos. Creads no puede igualar esos precios modelo por modelo sin perder plata.
- Donde **sí hay espacio** para competir de igual a igual o ganar: **Seedance** (BytePlus casi iguala a Higgsfield), **Veo 3.1 Fast**, **Nano Banana 2 / 2.1** y los **modelos nuevos baratos** (Grok Lite, Seedream Flash, MiniMax H3).
- Los créditos que Creads cobra hoy dejan al cliente pagando **entre 3 y 9 veces más que en Higgsfield**. Hay que revisar la tabla de créditos (`modelos` en `finance.ts`) junto con el dueño antes del lanzamiento. El costo de cada crédito para Creads está calculado en US$0,0193, así que hay margen para bajar.
- Advertencia: los créditos por modelo de Higgsfield vienen de artículos de terceros de septiembre y octubre (la herramienta de Higgsfield no los muestra) y Higgsfield cambia precios seguido. Lo confirmado directamente son los planes y los paquetes.

## 3. Migrar primero (ahorro × uso)

1. **Herramientas con Nano Banana Pro → Gemini directo** (editar imagen, crear personaje, primer cuadro de «personaje en video»). Ahorro de 11 %, cero trabajo de cuentas: ya tenemos la clave de Gemini.
2. **Nano Banana 2 → Gemini directo** (16 %). Además, **probar Nano Banana 2.1**, que cuesta la mitad (0,034) y según Google tiene mejor calidad.
3. **Seedream 5 Pro y OmniHuman 2 → BytePlus**, en la misma cuenta que se está abriendo para Seedance (33 % y ~56 %).
4. **Kling 3.0, Motion Control y Turbo → API oficial de Kling**. Es el modelo más usado de los que quedan en fal. Partir con el paquete de prueba de US$98 (vence en 30 días) para medir el uso real, y recién después comprar un paquete grande. Runware queda como segunda opción sin prepago (20 %).
5. **Mejorar video → WaveSpeed** (35 %), cuando haya volumen.
6. **Wan, Grok, Hailuo y FLUX**: cambiarse no ahorra nada. Dejarlos en fal por ahora, o pasarlos al dueño de cada modelo solo para no depender de fal (mismo precio).

## 4. Modelos nuevos para considerar (últimos ~60 días)

| Modelo | Fecha | Precio API | Por qué vale la pena |
|---|---|---|---|
| **Grok Imagine Video 1.5 Lite** (xAI) | 6-oct-2026 | 0,02/s a 480p · **0,03/s a 720p** · 0,14/s a 1080p, con audio | El video con audio más barato del mercado. Sirve para borradores y animaciones simples ([xAI docs](https://docs.x.ai/developers/models/grok-imagine-video-1.5-lite), [fecha](https://ayinedjimi-consultants.fr/news/grok-imagine-video-15-lite-xai-2026)) |
| **Nano Banana 2.1** (Google) | 6-oct-2026, versión final | **0,034 por imagen 1K** · 0,050 a 2K | La mitad del precio de Nano Banana 2 y mejor texto en las imágenes ([Google](https://ai.google.dev/gemini-api/docs/pricing), [noticia](https://letsdatascience.com/news/google-rolls-out-nano-banana-21-image-model-c6ac3b89)) |
| **Gemini Omni Flash 1.1** (Google) | 27-ago-2026, preview | ~0,10/s a 720p con audio · escenas de hasta 40 s | Ya está en la planilla. Ojo: la versión «preview» antigua se apaga el **22-oct-2026**; revisar que Creads use `gemini-omni-1.1-flash` ([Google](https://ai.google.dev/gemini-api/docs/pricing), [eesel](https://www.eesel.ai/blog/gemini-omni-1-1-flash-pricing)) |
| **Seedream 5.0 Flash** (ByteDance) | ~15-sep-2026 | **0,018 por imagen** | Imágenes baratas en la cuenta de BytePlus ([BytePlus](https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing)) |
| **Seedance 2.5** (ByteDance) | sep-2026 | 0,231/s a 720p en BytePlus | Ya está en el catálogo; en BytePlus cuesta la mitad que en fal |
| **Wan 3.0 / Wan 3.0 Prime** (Alibaba) | versión final 24-ago-2026 | 0,10/s a 720p, clips de hasta 30 s | Ya está; Prime no tiene precio confirmado ([Alibaba](https://www.alibabacloud.com/blog/603505)) |
| **MiniMax H3 y H3 Max** | 31-jul-2026 (justo fuera de los 60 días) | H3: 0,08/s a 768p, 0,13/s a 2K · H3 Max: 0,05/s a 480p | Audio nativo y hasta 15 s; reemplazo natural de Hailuo 2.3, que no tiene audio ([MiniMax](https://platform.minimax.io/docs/pricing/overview), [nota](https://pasqualepillitteri.it/en/news/9204/minimax-h3-2k-ai-video-open-weights)) |
| **ElevenLabs Eleven v4 y v4 Turbo** | 5-oct-2026 | v4: US$0,08 por 1.000 caracteres · Turbo: 0,04. También bajaron v3 y v2 un 20 % | Afecta la cuenta de voces que ya tenemos. Precio sin confirmar en la página oficial ([UsagePricing](https://www.usagepricing.com/blueprint/activity/elevenlabs-2026-10-05-v4-launch-tts-price-cut)) |
| **sync-3** (sync.so, sincronización de labios) | 2026 | 0,107–0,133/s (plan desde US$5 al mes) | Labios de mejor calidad que Kling, pero 8 a 9 veces más caro ([sync.so](https://sync.so/docs/product/billing.mdx)) |

## 5. Riesgos: NO usar

- **PiAPI**: vende APIs «no oficiales» (su propia integración de Midjourney se llama «PiAPI/Midjourney (unofficial)»), armadas sobre cuentas de consumidor. Rompe los términos de uso de los dueños de los modelos. **No aceptable.** ([Make](https://apps.make.com/piapi-midjourney?hl=ar-YE))
- **Kie.ai**: es revendedor y no está confirmado que tenga acuerdos oficiales. Midjourney le pidió retirar sus modelos en 2025. Tiene reclamos por tareas que quedan pegadas y créditos sin devolver (2,5 de 5 en Trustpilot). **No aceptable para clientes que pagan.** ([AI Insights, 21-jul](https://aiinsightsnews.net/kie-ai-review/))
- **Atlas Cloud, Evolink, SeedRouter, Apiframe, CometAPI, 302.ai, MuAPI y similares**: revendedores sin acuerdo oficial confirmado. Algunos anuncian «hasta 68 % menos que el precio oficial», lo que es una señal de alerta. **No usar** salvo que se confirme por escrito que son socios oficiales.
- **HappyHorse 1.0** (Alibaba): en el canal oficial (Qwen) solo existe en una beta cerrada para China, así que la única forma de usarlo es por revendedores. **No usar por ahora.**
- Por verificar antes de usar en producción: si **Runware** y **WaveSpeed** tienen acuerdos con Kling y con ByteDance (Kling y OmniHuman son modelos cerrados). Para SeedVR2 no hay problema, porque es un modelo abierto.

## Notas de método

- No se pudieron abrir directamente `kling.ai/dev/pricing` ni `klingai.com/global/dev/pricing` (la página carga con JavaScript o el acceso estaba bloqueado). Los precios de Kling vienen de tres fuentes de terceros que citan la tabla oficial y coinciden entre sí (0,6 / 0,9 / 1,2 unidades por segundo a US$0,14 la unidad). **Confirmar en el panel de Kling al abrir la cuenta.**
- Precios oficiales leídos directamente: MiniMax, Alibaba (ficha de wan3.0), xAI, Google Gemini API, BytePlus ModelArk, Black Forest Labs (Klein), sync.so y BytePlus OmniHuman. También los planes de Higgsfield, leídos desde la cuenta del dueño.
- No confirmado: el precio de fal para Motion Control y para la edición de video con Kling O1, el precio oficial de lip-sync de Kling, el precio de Bria directo y el precio de Wan en la región de EE.UU.
