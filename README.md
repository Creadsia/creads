# Creads

Plataforma para crear anuncios de video para lead-gen en Meta: pegas tu guion ganador y recibes anuncios terminados.

## Estado
Fase 0: página con lista de espera de fundadores y estructura de la capa de modelos. El prototipo funcional está en `legacy/`.

## Correr en local
```bash
npm install
npm run dev
```
Abre http://localhost:3000. Para que la lista de espera guarde correos, copia `.env.example` a `.env.local` y completa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, y corre `supabase/schema.sql` en el SQL Editor de Supabase.

## Revisar servicios conectados
`/api/health` muestra qué servicios tienen su clave configurada (nunca muestra las claves).
