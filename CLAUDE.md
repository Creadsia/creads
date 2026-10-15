# Creads

Creads is a SaaS for lead-gen advertisers on Meta (auto insurance, bath remodel, foundation repair…): the user pastes a winning script and gets finished video ads — cuts, AI video, voice, subtitles and automatic QA. Owner: Creadsia (hola@creadsia.com), domain creadsia.com. The owner is non-technical and speaks Spanish: talk to him in plain Spanish (Chile), no jargon.

## Vision (owner's words, Oct 2026)
Compete head-on with Higgsfield and win Latin America. Creads exists to help marketers grow, so it protects the customer's money:
- **As many models as possible** behind one simple studio (Veo, Kling, Seedance, Nano Banana, ElevenLabs, and more as they appear).
- **Fewer errors**: every failed generation is money the customer loses. Check before spending, QA after, free automatic redos, never charge for our failures. The system keeps learning: failures and fixes are stored as rules (like `vrules` in the prototype) and fed back into prompts for every customer.
- **Easy**: Spanish and English, simple flows that replace a full day of work. Easier than Higgsfield.
- **Price/quality** is the brand. API and MCP access for power users and agencies.

## Where it comes from
`legacy/creads-artifact.html` is the working prototype (a single-page Claude artifact) and `legacy/af.py` its montage tool (Whisper QA, FFmpeg assembly, ASS subtitles, contact sheets). They are the source of truth for behaviour being migrated: formats (ugc, podcast, entrevista, ronda, noticiero, comentario, drive-thru), FORMAT_LOCK/FMT_DIR prompts, cut rules (≤8 cuts, dialogue cuts for podcast), number normalisation in QA, severe-only auto-redo (max 1 per cut, 2 per ad), learned rules (`vrules`), image QA and safe zones, 4:5 feed images, Chilean Spanish mode. Read the relevant part before re-implementing a feature.

## Stack
- Next.js 15 (App Router, TypeScript, Tailwind 4) on Vercel.
- Supabase (Postgres, auth, storage). Schema in `supabase/schema.sql`.
- Model layer in `src/lib/providers`: every outside service behind an interface (video, image, voice, text AI). Never call a provider directly from a page.
- Keys only in environment variables (`.env.example` lists the names). Never commit or log them.

## Roadmap (see the plan doc)
- Phase 0: model comparison test, accounts, waitlist (this commit).
- Phase 1 (weeks 3–6): providers wired (Gemini API for Veo + Nano Banana, fal.ai for Seedance/Kling, ElevenLabs, Claude API), job queue with retries, montage worker (FFmpeg + Whisper, port of af.py).
- Phase 2 (weeks 7–10): login, credits, Stripe plans, library, avatars/products with consent.
- Phase 3: paid founders beta. Phase 4: open launch.

## Rules
- UI copy in Spanish; code and comments in English.
- Dark "modo suave" theme with violet accent (`--accent`, `--grad`) as in the prototype.
- Don't spend generation credits on tests without telling the owner.
