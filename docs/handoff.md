# Creads IA — traspaso completo (18 de octubre de 2026)

Este documento resume TODO lo que Gastón y Claude (estudio de desarrollo en la nube) construyeron y decidieron hasta el 18-oct-2026, para que cualquier sesión nueva de Claude Code siga trabajando sin perder el hilo. Léelo entero antes de tocar algo. `CLAUDE.md` (raíz) tiene las reglas permanentes.

## 1. Personas y forma de trabajo

- **Gastón Johnstone** (dueño, hola@creadsia.com / gijohnstones@gmail.com), Chile. No es técnico. Háblale en español de Chile, simple, corto, con pasos numerados, links exactos y qué apretar. Trabaja rápido, desde el celular y el Mac, y abre muchos frentes: ayúdale a priorizar. Quiere efectividad: respuesta primero, nada de rodeos ni de «no puedo».
- **Benjamín Seguel** (seguelbenja@gmail.com): socio a cargo de MARKETING. Acceso «Completo + Panel interno». Entra al Panel SIN verificación en dos pasos hasta el **18-nov-2026** (excepción temporal en `src/lib/admin.ts`, por hash del correo; vence sola). Solo Gastón nombra/quita socios.
- **Claude**: programa y publica la plataforma. La «Oficina» del Panel (agentes) solo propone; lo que gasta plata o publica se aprueba con un clic.

Reglas que no se rompen:
- Nunca pegar ni pedir claves/tokens en el chat; van en Vercel o en Panel → Marketing → Conexiones (cifradas).
- No gastar créditos de generación en pruebas sin avisar.
- Al cliente nunca se le muestran proveedores, saldos, claves ni errores técnicos; la IA es «Creads IA» (sí se nombran modelos: Veo, Kling, Seedance, Nano Banana, ElevenLabs).
- No prometer «si falla no pagas». Precios siempre en US$.
- Cambios riesgosos (pagos, créditos, base de datos, auth, proveedores) idealmente a `staging` primero; staging aún NO existe, así que se ha publicado en `main` con pruebas y revisión. Cada push a `main` despliega creadsia.com.

## 2. Negocio y foco (decidido el 18-oct)

- Creads IA = plataforma de generación con IA: videos, audios/voces, UGC, avatares e imágenes en un estudio simple. Norte: competir con Higgsfield y ser la más grande de Latinoamérica y luego del mundo.
- **Foco único: hacer crecer Creads IA.** Seguros, remodelaciones, etc. son solo EJEMPLOS de lo que produce, nunca el cliente ni una campaña. (El texto antiguo de CLAUDE.md que hablaba de «lead-gen advertisers» quedó corregido.)
- Precios: Starter US$119 (1.000 créditos), Plus US$219 (3.000), Studio US$449 (8.000); anual US$99/182/374 por mes; recargas US$25/89/209; 50% el primer mes. Costo interno ≈ US$0,0193 por crédito.
- Identidad visual real (de globals.css): negro #000 / claro #F4F5F7, texto blanco #F3F4F6, degradado magenta #FF2BD6 → violeta #8A5CFF → cian #19E3FF, cian #5CE9FF para links. Tipografías Unbounded (títulos) y Geist (texto). Guía completa en `MARCA` (`src/lib/oficina-contexto.ts`).

## 3. Lo que existe hoy (Panel interno, creadsia.com/admin)

Menú por áreas (`src/lib/areas.ts`), cada una con sus agentes arriba (Informe / Hablar / Trabajar ahora):
- **Dirección**: CEO General y agentes (Oficina) + Personas y accesos (invitar, «Estudio completo» o «Completo + Panel interno», traer a alguien que ya tiene cuenta, quitar).
- **Lanzamiento**: lista de lo que falta (se revisa sola).
- **Ventas y finanzas**: Estadísticas, Rentabilidad, Proyección, Movimientos, Costos fijos, Planes y afiliados, Costo por modelo. Agente: Finanzas y ventas.
- **Marketing** (`src/app/admin/marketing.tsx`, `src/lib/marketing.ts`, `src/lib/meta-graph.ts`):
  - **Conexiones con Meta** (`src/lib/meta-conexiones.ts`): píxel, token API de conversiones, token del usuario del sistema, cuenta publicitaria, página, Instagram, webhook de comentarios. Guardado cifrado (AES-GCM con clave derivada de SUPABASE_SERVICE_ROLE_KEY) en el bucket privado; gana sobre Vercel. Botón «Probar conexión» (lee el píxel con el token del sistema; prueba de envío CAPI solo con código de prueba, un ViewContent). Estado al 18-oct: Meta conectado, Instagram ✅, app de Meta publicada.
  - **Ideas y referencias** (texto, link, imagen descrita con visión): los agentes las usan primero.
  - **Producción automática de videos** (`src/lib/autoprod.ts`, `/api/produccion`): pedido aprobado → cortes → escenas → clips → revisión de calidad (rehace gratis lo grave) → montaje con subtítulos y sello «Hecho con Creads IA». Usa los endpoints del estudio como la cuenta **robot@creadsia.com** (miembro del equipo main; sesión cifrada en el bucket). Avanza cada 5 min (ping del Guardián) con máximo diario y modelo configurables. RECIÉN publicado: falta probar el primer video real.
  - Tope de gasto diario, campañas en Meta (se suben en pausa; «lánzala» las activa al aprobar, siempre dentro del tope; también «solo estructura» sin video), pedidos de anuncios, cuentas de Instagram de la marca, respuesta automática a comentarios.
  - Agentes: Director de Marketing, Creativos, Trafficker, **Community manager** (antes «Contenido orgánico»: calendario semanal, banco de contenido, una publicación diaria, ve el feed con visión).
- **Clientes**: Clientes y accesos (incluye «Pasar a mi equipo como socio»), Registros. Agente: Atención al cliente.
- **Plataforma**: **Guardián** (`src/lib/guardian.ts`, `/api/guardian`): revisa cada 5 min vía UptimeRobot (monitor Keyword «OK» con GUARDIAN_TOKEN), pausa modelos que fallan a 2+ clientes, devuelve créditos de clips trabados (consulta al proveedor antes), avisa por correo y **Telegram** (bot propio, `src/lib/whatsapp.ts`), despierta al jefe del área. También Errores y alarmas, Saldos, Estado, Cuentas.

**Influencer IA (18-oct, nuevo)** — `/app/influencer` y `/app/influencer/nuevo`, `src/lib/influencer/traits.ts`, `/api/personajes`, herramienta `crear-personaje` (Nano Banana Pro, US$0,15 por ficha, 16:9, sin referencias usa `fal-ai/nano-banana-pro`, con referencias `/edit`). Creador por opciones (Normal/Raro/Total/Animales, «Sorpréndeme», texto libre, 1 cara de guía + 3 de estilo con permiso), ficha (frente/perfil/espalda/cara), guardado como avatar (`notes` = {kind:"personaje", traits}), límite por plan (Starter 1, Plus 3, Studio ilimitado), elegible en «Copiar movimiento». Pendiente: selector 720p/1080p (verificar endpoint/precio pro de Kling Motion Control), dos personajes en un video, tiradas gratis (decisión de Gastón), bloqueo automático de famosos, probar 3 personajes reales (gasta créditos: avisar).

**Estrategia de personajes virales (Gastón, 18-oct)** — en `ESTRATEGIA_PERSONAJES` (`src/lib/oficina-contexto.ts`), la leen todos los de Marketing: cuentas de PERSONAJE propio (no humanos IA genéricos), inspiradas en el formato de Abu Shalab/Haroldpuddington sin copiarlas; 1 personaje principal + 1 secundario + cuenta oficial; arquetipos absurdo/icónico, tierno/refinado, caos/humor; el personaje entretiene y el embudo vende (bio «Hecho con Creads IA», «comenta CREADS» → DM automático → link → registro); 30 días: 2 personajes × 10–15 videos, medir retención, compartidos, comentarios, seguidores por reel, clics al perfil, DMs y registros, y quedarse con el que pega. Cada personaje guardado tiene su «biblia» (arquetipo, personalidad, tono, frases, gestos, tipos de reels) y el Community manager la lee (fuente «Personajes de Creads»). Métricas finas (retención, compartidos, seguidores por reel) requieren el permiso `instagram_manage_insights`: pendiente.

## 4. La Oficina (agentes) — `src/lib/oficina.ts`

- Cerebro: **Claude** por defecto (chat y líderes en `claude-opus-5-5`, informes del equipo en `claude-sonnet-5-5`; `src/lib/providers/claude-office.ts`). Grok (xAI) hace las búsquedas web/X y es el cerebro por defecto de Novedades IA y Community manager. Badge Claude/Grok por agente (tocar para cambiar).
- Contexto que leen: `COMPANY`, `CONTEXTO` y `MARCA` (`src/lib/oficina-contexto.ts`), `BRIEFING`, la Memoria (editable), y sus fuentes de datos.
- Chat eficiente (`CHAT_STYLE`), sabe quién escribe (Gastón o socio). Si propone una acción en el chat, queda de verdad en «Por aprobar» y aparece con botones «Aprobar y hacerlo / Rechazar» en el mismo chat.
- Ritmo: 8:00 diario (cron) + rondas extra configurables (Marketing o todos) usando el ping del Guardián. Tope mensual de gasto de la oficina (recomendado subirlo a ~US$80–150 con Claude).
- Encargos para Claude → issues de GitHub (label `encargo-claude`) con GITHUB_ENCARGOS_TOKEN.

## 5. Pagos

- Hoy: Mercado Pago (CLP) en código, `settleOrder` (`src/lib/settle.ts`) → RPC `apply_payment` (idempotente por `payments.id` y ref `pay:%`).
- Decisión previa: LLC en EE.UU. + Stripe en US$ (pendiente).
- **Nuevo pedido (18-oct): pagos SOLO con cripto (USDT/USDC) vía NOWPayments**, compras únicas de 30 días, sin Stripe/Mercado Pago. Etapa 1 (diagnóstico) entregada; **NO implementado** hasta aprobación. Hallazgos: los términos de FD Transfers LLC (custodia/fiat de NOWPayments) excluyen residentes/ciudadanos de EE.UU., UE, Reino Unido, EAU y Rusia (Chile no figura) → registrarse como persona/empresa chilena, no la LLC; confirmar por escrito si clientes de EE.UU./UE pueden pagar; retiro fiat solo EUR desde USDT-TRC20. Plan: checkout alojado (invoice), IPN con HMAC-SHA512 (`x-nowpayments-sig`) + re-consulta del pago, `finished` → `settleOrder` con fuente nueva, `partially_paid` → «Revisión requerida», reconciliación cada 5 min, sección «Pagos cripto» en el Panel, ocultar (no borrar) Mercado Pago. Decisiones pendientes de Gastón: entidad, correo a NOWPayments, MP oculto o borrado, si aplica el 50% del primer mes.

## 6. Pendientes y próximos pasos

Del dueño: subir el tope de la Oficina; cambiar GUARDIAN_TOKEN por una clave aleatoria (la actual quedó en un chat) y actualizar UptimeRobot; agregar @creadsia en «Cuentas de Instagram de la marca» si falta; probar el primer video de la producción automática; decisiones de pagos cripto; LLC/asesor; abogado; Vercel/Supabase Pro; verificación en dos pasos en todo.

Ideas propuestas por Claude (no hechas): aprobar desde Telegram con botones; sello «Hecho con Creads IA» obligatorio en prueba/Starter (motor viral); bloqueo de deepfakes de famosos + registro de consentimiento + marca invisible; página pública por video «Hazlo tú»; atribución por publicación de Instagram; páginas SEO en español vs Higgsfield; programa de agencias; primer video en 3 minutos; reintento automático con otro modelo; anti-abuso de prueba gratis; Guardián vigilando gasto anómalo por cuenta; 30 videos de prueba para definir modelos por plan con datos reales; campaña de seguidores al perfil de Instagram (hoy las campañas solo llevan a creadsia.com).

AdsPower (18-oct): Gastón quiere conectar la API local de AdsPower (puerto 50325, `curl http://local.adspower.net:50325/status`) y el MCP oficial `local-api-mcp-typescript` a Claude, SOLO LECTURA (listar perfiles; no abrir/cerrar perfiles, no entrar a Facebook, no modificar). La clave de AdsPower nunca va en el chat; va en la config local del MCP.

## 7. Variables de entorno (solo nombres)

ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_FAST_MODEL, CLAUDE_OFFICE_MODEL, CLAUDE_OFFICE_MODEL_CEO, XAI_API_KEY, XAI_MODEL, XAI_MODEL_CEO, GEMINI_API_KEY, FAL_KEY, FAL_BILLING_KEY, ELEVENLABS_API_KEY, SCRAPECREATORS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, CRON_SECRET, GUARDIAN_TOKEN, ADMIN_ACCESS_CODE, RESET_SECRET, GITHUB_ENCARGOS_TOKEN, GITHUB_REPO, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_ONE_TIME, NEXT_PUBLIC_META_PIXEL_ID, META_* (opcionales: ahora se configuran en el Panel), TELEGRAM_BOT_TOKEN, CALLMEBOT_PHONE/KEY, WHATSAPP_* (opcionales), SITE_URL, NEXT_PUBLIC_WHATSAPP.

## 8. Cómo verificar antes de publicar

`npx tsc --noEmit -p .`, `npx eslint src tests`, `npm test` (123 pruebas al 18-oct), `npm run build`. Commits en inglés; textos de la plataforma en español (tú).

## Influencer IA: «Mi personaje en un video» (18 Oct 2026, night)
- New tool `personaje-en-video` (Recrear opens it by default with a saved character): free check before charging (`/api/revisar-video`, `lib/influencer/swap.ts` analyzeVideo/judge, cached per video) → Nano Banana Pro puts the character in the first frame where the main person's upper body is visible (frame + sheet + face crop) → Claude reviews the picture (1 free redo; refunded if still wrong) → Kling v3 Motion Control with `elements` (@Element1 face lock from the face kit cut out of the sheet, stored in the avatar's `notes.face`) → Claude reviews 6 frames of the video (1 free redo) → delivered. Job id `swap:<json>`; steps advance from the status check, locked with `hit_rate` on a hash of the job.
- Video > first shot or late start: only the usable part is cut, used and billed.
- Editar video now takes 3–30 s (cut into ≤3 parts, edited at once, joined: `partsPlan/cutParts/joinParts`). Silent option on all recreate tools (`sound`).
- Panel → Plataforma → Calidad de videos (`lib/calidad.ts`): clean-first-try %, free redos, failures, top review problems, failure reasons, learned rules (format `personaje`) to approve.
- Not yet tested with real generations (costs credits). Research: project doc `claude/influencer-video-calidad.md`.
- «Mi personaje · Máxima calidad» (`personaje-genjutsu`): Higgsfield Genjutsu via Comfy Router (`lib/providers/comfy.ts`, model `higgsfield/higgsfield-genjutsu-motion-transfer-v1.0`, queue API with Idempotency-Key). References = front body + face from the face kit (never the 4-view sheet). Review + 1 free redo, silent option strips audio. Appears in Recrear (default with a character) only when `COMFY_API_KEY` is set. Cost default US$0,35/s (`NEXT_PUBLIC_GENJUTSU_USD_PER_SEC`). Tested on Higgsfield web 18 Oct: good on the first try (owner).
- Pricing decision (owner, 18 Oct): the business is judged as a whole, not per model. Products that make the platform work well can run near cost (Máxima calidad: cheapest credit pays cost + 35%, `bill` in ToolDef, `NEXT_PUBLIC_GENJUTSU_MARGIN`); margin comes from the rest. Priority #1: that it works well. Confirm Comfy's real cost after the first videos and adjust `NEXT_PUBLIC_GENJUTSU_USD_PER_SEC`.
- Public API v1 (19 Oct): API keys = hashed long-lived sessions (`createApiKey/listApiKeys/revokeApiKey` in auth.ts, `Authorization: Bearer creads_sk_…` accepted by `userFromRequest`), page /app/api («API para sistemas»). `POST /api/v1/anuncios` + `GET /api/v1/anuncios/{id}` (lib/api-ads.ts) run the ad pipeline (lib/ad-runner.ts, shared with autoprod) one step per poll. First client: Halcón (separate project, owner's lead-gen launcher: Meta multi-account + RedTrack + Creads API + Grok/Claude agents). Mockup: Design artifact «Halcón: maqueta del Lanzador».

## Connector for Claude and ChatGPT (MCP), 19 Oct 2026 (branch `mcp`, on staging)
- `/api/mcp`: MCP «Streamable HTTP» without sessions (JSON answers in each POST). Tools: creads_saldo, creads_crear_imagen, creads_crear_anuncio, creads_estado_anuncio, creads_mis_anuncios (`src/lib/mcp.ts`), each with title + read/write annotations. They call the public endpoints with the caller's key, so credits, limits and QA are the same. Errors say "no credits" without upgrade pitches (ChatGPT rule).
- OAuth 2.1 (`src/lib/oauth.ts`): discovery at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` (+ openid-configuration), dynamic registration `/api/oauth/register` (stateless signed client ids, https or localhost redirects), consent `/app/conectar` → `/api/oauth/authorize` (browser session only; JSON redirect because CSP form-action is 'self'), `/api/oauth/token` (PKCE S256, one-time codes in private storage). The access token is an API key named "<App> (conector)" (max 3 per app), visible and revocable in «API y conector». Optional env OAUTH_SECRET (else derived from the service key).
- Home page section «Creads dentro de Claude, ChatGPT y tus sistemas» (#conectar), API page renamed «API y conector» with the connector guide, privacy policy paragraph on connected apps.
- Pending: test with real Claude and ChatGPT on staging; then directory submissions (Claude: claude.ai/directory/manage; ChatGPT: verified developer, no selling credits inside ChatGPT, present Creads as its own product).
