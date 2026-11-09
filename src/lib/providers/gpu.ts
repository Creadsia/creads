import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ImageProvider, ImageRequest, Job, JobStatus, VideoProvider, VideoRequest } from "./types";

// Self-hosted GPU (ComfyUI) providers. Replace the paid frame/B-roll/talking providers (Nano Banana, fal.ai,
// Kling/MiniMax) with open models that run on our own RTX 4090 at ~the cost of electricity, with no per-second
// API fee and no dependency on a third-party balance. All models chosen are commercially licensed (see
// `stack-modelos-gpu.md` in the project):
//   - Images:        Qwen-Image            (Apache-2.0)  -> replaces Nano Banana
//   - Image edit:    Qwen-Image-Edit-2511  (Apache-2.0)  -> product-consistent edits
//   - B-roll video:  Wan 2.2               (Apache-2.0)  -> replaces fal.ai/Seedance
//   - Talking video: InfiniteTalk          (Apache-2.0)  -> replaces Kling/MiniMax/HeyGen (natural movement)
// Voice (Chatterbox) is a separate provider in `chatterbox.ts` (it's a TTS REST service, not ComfyUI).
//
// This talks to a plain ComfyUI server over its HTTP API (NOT api.comfy.org — that's `comfy.ts`):
//   POST /prompt   {prompt:<workflow>, client_id}          -> {prompt_id}
//   GET  /history/{id}                                      -> {<id>:{outputs:{<node>:{images|gifs|videos:[...]}}}}
//   GET  /view?filename=..&subfolder=..&type=output         -> the file bytes
//   POST /upload/image  (multipart)                         -> uploads a ref image/audio, returns its name
// The ad pipeline re-hosts whatever url we return (clips/status saveMedia), so we hand back a /view url.
//
// Config (Vercel env): GPU_ENABLED=1 turns these on (off by default — production untouched until set);
// GPU_COMFY_URL=https://<pod>-8188.proxy.runpod.net the ComfyUI base; GPU_COMFY_TOKEN optional bearer.
//
// The ComfyUI workflows live as API-format JSON templates in ./workflows and are filled at runtime by
// replacing {{TOKENS}}. Export them from the validated ComfyUI graph ("Save (API Format)") after installing
// the models on the GPU, keeping the {{TOKENS}} in place. The exact graphs must be confirmed on staging
// before merging to main — the model filenames/node ids depend on what is installed.

export const gpuConfigured = () =>
  process.env.GPU_ENABLED === "1" && /^https?:\/\/[^\s]+$/.test((process.env.GPU_COMFY_URL ?? "").trim());

const base = () => (process.env.GPU_COMFY_URL ?? "").trim().replace(/\/+$/, "");
const headers = (): Record<string, string> => {
  const h: Record<string, string> = { "content-type": "application/json" };
  const t = (process.env.GPU_COMFY_TOKEN ?? "").trim();
  if (t) h.authorization = `Bearer ${t}`;
  return h;
};

// ── ComfyUI client ────────────────────────────────────────────────────────────

/** Fill a workflow template (API format JSON with {{TOKENS}}) and return the graph object. */
function buildWorkflow(name: string, vars: Record<string, string | number>): Record<string, unknown> {
  let text = readFileSync(join(process.cwd(), "src/lib/providers/workflows", `${name}.json`), "utf8");
  for (const [k, v] of Object.entries(vars)) {
    // JSON.stringify so strings/newlines are escaped correctly inside the JSON template.
    text = text.split(`"{{${k}}}"`).join(JSON.stringify(v));
  }
  const graph = JSON.parse(text) as Record<string, unknown>;
  // Drop doc-only keys (e.g. "_note"): ComfyUI treats every top-level key as a node and would reject them.
  for (const k of Object.keys(graph)) if (k.startsWith("_")) delete graph[k];
  return graph;
}

async function submitWorkflow(workflow: Record<string, unknown>, what: string): Promise<string> {
  const res = await fetch(`${base()}/prompt`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prompt: workflow, client_id: `creads-${Date.now().toString(36)}` }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("gpu submit", res.status, detail.slice(0, 400));
    throw new Error(`${what}: la GPU rechazó el trabajo (${res.status}). Revisa que ComfyUI esté prendido y los modelos instalados.`);
  }
  const d = (await res.json().catch(() => null)) as { prompt_id?: string } | null;
  if (!d?.prompt_id) throw new Error(`${what}: la GPU no devolvió un trabajo (¿ComfyUI apagado?).`);
  return d.prompt_id;
}

type ComfyFile = { filename: string; subfolder?: string; type?: string };
type Outputs = Record<string, { images?: ComfyFile[]; gifs?: ComfyFile[]; videos?: ComfyFile[] }>;

async function pollHistory(id: string): Promise<{ done: false } | { done: true; outputs: Outputs; error?: string }> {
  const res = await fetch(`${base()}/history/${id}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return { done: false };
  const hist = (await res.json().catch(() => null)) as Record<string, { outputs?: Outputs; status?: { status_str?: string } }> | null;
  const entry = hist?.[id];
  if (!entry) return { done: false };
  if (entry.status?.status_str === "error") return { done: true, outputs: {}, error: "La GPU falló al generar (revisa el workflow/los modelos)." };
  return { done: true, outputs: entry.outputs ?? {} };
}

function firstFile(outputs: Outputs): ComfyFile | undefined {
  for (const node of Object.values(outputs)) {
    const f = node.gifs?.[0] ?? node.videos?.[0] ?? node.images?.[0];
    if (f?.filename) return f;
  }
  return undefined;
}

const viewUrl = (f: ComfyFile) =>
  `${base()}/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder ?? "")}&type=${encodeURIComponent(f.type ?? "output")}`;

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`No se pudo bajar el archivo de la GPU (${res.status}).`);
  return res.arrayBuffer();
}

/** Upload a hosted ref (face image or audio) into ComfyUI's input/ so a workflow can reference it by name. */
async function uploadRef(url: string, kind: "image" | "audio"): Promise<string> {
  const bytes = await (await fetch(url)).arrayBuffer();
  const name = `creads_${kind}_${Date.now().toString(36)}.${kind === "image" ? "png" : "wav"}`;
  const form = new FormData();
  form.append("image", new Blob([bytes]), name); // ComfyUI /upload/image also accepts audio files
  form.append("overwrite", "true");
  const auth = (process.env.GPU_COMFY_TOKEN ?? "").trim();
  const res = await fetch(`${base()}/upload/image`, { method: "POST", body: form, headers: auth ? { authorization: `Bearer ${auth}` } : {} });
  if (!res.ok) throw new Error(`No se pudo subir el ${kind} a la GPU (${res.status}).`);
  const d = (await res.json().catch(() => null)) as { name?: string } | null;
  return d?.name ?? name;
}

const px = (n: number) => Math.round(n / 16) * 16;
const dims = (aspect: string): [number, number] =>
  aspect === "9:16" ? [480, 832] : aspect === "16:9" ? [832, 480] : aspect === "4:5" ? [512, 640] : [576, 576];
const seed = () => Math.floor(Math.random() * 1e15);

// ── Images: Qwen-Image (+ Qwen-Image-Edit when refs are given) ───────────────────

/** Qwen-Image on the GPU — the scene/frame image generator (replaces Nano Banana). Apache-2.0.
 *  When the request carries product/face refs, uses the Qwen-Image-Edit workflow to keep that product. */
export const qwenImageGpu: ImageProvider = {
  id: "qwen-image-gpu",
  label: "Qwen-Image (GPU propia)",
  usdPerImage: 0, // runs on our GPU; only the shared GPU-hour
  configured: gpuConfigured,
  async generate(req: ImageRequest): Promise<{ bytes: Uint8Array; mime: string }> {
    const [w, h] = dims(req.aspect);
    const refs = req.refs ?? [];
    let workflow: Record<string, unknown>;
    if (refs.length) {
      // product/person-consistent edit: upload the refs and feed them to Qwen-Image-Edit
      const img1 = await uploadRef(refs[0].url, "image");
      const img2 = refs[1] ? await uploadRef(refs[1].url, "image") : img1;
      workflow = buildWorkflow("qwen-image-edit", { PROMPT: req.prompt, WIDTH: px(w), HEIGHT: px(h), IMAGE1: img1, IMAGE2: img2, SEED: seed() });
    } else {
      workflow = buildWorkflow("qwen-image", { PROMPT: req.prompt, WIDTH: px(w), HEIGHT: px(h), SEED: seed() });
    }
    const id = await submitWorkflow(workflow, "Imagen (GPU)");
    for (let i = 0; i < 120; i++) {
      const r = await pollHistory(id);
      if (r.done) {
        if (r.error) throw new Error(`Imagen (GPU): ${r.error}`);
        const f = firstFile(r.outputs);
        if (!f) throw new Error("Imagen (GPU): la GPU no devolvió una imagen.");
        return { bytes: new Uint8Array(await fetchBytes(viewUrl(f))), mime: "image/png" };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Imagen (GPU): la GPU tardó demasiado.");
  },
};

// ── B-roll: Wan 2.2 (silent) ─────────────────────────────────────────────────────

/** Wan 2.2 on the GPU — B-roll scenes (silent: never the talking head). Apache-2.0. */
export const wanBrollGpu: VideoProvider = {
  id: "wan-gpu",
  label: "Wan 2.2 (GPU propia)",
  usdPerSecond: 0,
  silent: true, // text/image-to-video, no lip-sync — for B-roll only
  aspects: ["9:16", "16:9", "1:1", "4:5"],
  configured: gpuConfigured,
  async submit(req: VideoRequest): Promise<Job> {
    const [w, h] = dims(req.aspect);
    const secs = Math.min(5, Math.max(2, req.seconds));
    const frames = Math.min(81, Math.round(secs * 16) + 1); // 16 fps
    const workflow = buildWorkflow("wan-t2v", { PROMPT: req.prompt, WIDTH: px(w), HEIGHT: px(h), FRAMES: frames, SEED: seed() });
    return { provider: this.id, jobId: await submitWorkflow(workflow, "B-roll (GPU)") };
  },
  async status(job: Job): Promise<JobStatus> {
    const r = await pollHistory(job.jobId);
    if (!r.done) return { state: "running" };
    if (r.error) return { state: "failed", error: r.error };
    const f = firstFile(r.outputs);
    return f ? { state: "done", url: viewUrl(f) } : { state: "failed", error: "B-roll (GPU): la GPU no devolvió un video." };
  },
  download: (url: string) => fetchBytes(url),
};

// ── InfiniteTalk via RunPod Serverless (scales to many workers; pay per second) ───
// When RUNPOD_API_KEY + RUNPOD_ITK_ENDPOINT are set, the talking-head job runs on our RunPod serverless
// endpoint (custom worker in the `itk-worker` branch) instead of the single always-on pod. Many workers run
// in parallel and scale to zero when idle.
// Worker config (the proven, fast recipe — see Dockerfile/I2V_single.json in itk-worker):
//   480p fp8 base (Wan2_1-I2V-14B-480P) + lightx2v cfg-step-distill LoRA, 6 steps, cfg 1, dpm++_sde, shift 11.
//   The worker auto-sizes the clip from the audio length (we do NOT send max_frame) and reads force_offload
//   from the input (default true = OOM-safe on a small GPU; set false only on a 48GB+ GPU for ~1.5x speed).
// Worker API (our fork of wlsdml1114/Infinitetalk_Runpod_hub):
//   POST https://api.runpod.ai/v2/{endpoint}/run  {input:{input_type,person_count,image_url,wav_url,prompt,width,height}, policy:{executionTimeout}} -> {id}
//   GET  https://api.runpod.ai/v2/{endpoint}/status/{id} -> {status, output:{video:"data:video/mp4;base64,..."}}
// executionTimeout (ms): the max a job may RUN on a worker (queue time excluded). On the 48GB endpoint with no
// CPU offload a real talking cut takes ~2–5 min (≤10 even cold), so 15 min is ample headroom. Keeping it low is
// deliberate: a worker that hangs (owner, 9 Nov 2026: cuts stuck ~25 min) is killed as TIMED_OUT and the cut
// retries on a healthy worker, instead of sitting dead for up to an hour. Raise only if moving to a slower GPU.
const RUNPOD_EXEC_TIMEOUT_MS = 15 * 60 * 1000; // 15 min: real cuts finish well under this; hung ones fail fast and retry
const itkEndpoint = () => (process.env.RUNPOD_ITK_ENDPOINT ?? "").trim();
const runpodKey = () => (process.env.RUNPOD_API_KEY ?? "").trim();
/** Whether the talking head should run on our RunPod serverless endpoint (preferred over the pod when set). */
export const itkServerlessOn = () => Boolean(itkEndpoint() && runpodKey());
const runpodHeaders = () => ({ "content-type": "application/json", authorization: `Bearer ${runpodKey()}` });
const runUrl = () => `https://api.runpod.ai/v2/${itkEndpoint()}/run`;
const statusUrl = (id: string) => `https://api.runpod.ai/v2/${itkEndpoint()}/status/${id}`;

// Talking-video render size. The installed worker runs the 480p base + 480p distill LoRA, so we render at
// 480p-class sizes (divisible by 16): rendering bigger than the model's native resolution is slower AND lower
// quality (off-distribution). 480x832 is the canonical 480p vertical; a bigger GPU can revisit these upward.
const talkDims = (aspect: string): [number, number] =>
  aspect === "9:16" ? [480, 832] : aspect === "16:9" ? [832, 480] : aspect === "4:5" ? [512, 640] : [512, 512];

async function runpodSubmitTalk(req: VideoRequest, faceUrl: string, audioUrl: string): Promise<string> {
  const [w, h] = talkDims(req.aspect);
  const body = {
    input: {
      input_type: "image",
      person_count: "single",
      prompt: req.prompt || "a person talking to the camera, natural gestures, photorealistic",
      image_url: faceUrl,
      wav_url: audioUrl,
      width: px(w),
      height: px(h),
      // Speed on the 48GB endpoint: the 480p fp8 model fits entirely in VRAM, so skip the CPU offload that
      // only a small GPU needs. blocks_to_swap:0 = no per-step block offload; force_offload:false = keep the
      // model on-GPU. Together these cut the render time many-fold vs. the workflow defaults (20 / true).
      // If a future GPU is smaller, raise blocks_to_swap (e.g. 20) and set force_offload:true here.
      blocks_to_swap: 0,
      force_offload: false,
      // The clip length is auto-calculated from the audio by the worker, so we don't send max_frame.
    },
    // Raise RunPod's 30-min per-job cap so a slow (block-swapped) render on the small GPU isn't killed midway.
    policy: { executionTimeout: RUNPOD_EXEC_TIMEOUT_MS },
  };
  const res = await fetch(runUrl(), { method: "POST", headers: runpodHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("runpod submit", res.status, detail.slice(0, 400));
    throw new Error(`Habla (GPU serverless): RunPod rechazó el trabajo (${res.status}).`);
  }
  const d = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!d?.id) throw new Error("Habla (GPU serverless): RunPod no devolvió un trabajo.");
  return `rp:${d.id}`; // marker so status()/download() know this job is on the serverless endpoint
}

async function runpodTalkStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(statusUrl(jobId.slice(3)), { headers: runpodHeaders(), cache: "no-store" });
  if (!res.ok) return { state: "running" };
  const d = (await res.json().catch(() => null)) as { status?: string; output?: { video?: string; error?: string }; error?: string } | null;
  switch (d?.status) {
    case "COMPLETED":
      return d?.output?.video ? { state: "done", url: `rpvideo:${jobId.slice(3)}` } : { state: "failed", error: d?.output?.error || "La GPU serverless no devolvió un video." };
    case "FAILED":
    case "CANCELLED":
    case "TIMED_OUT":
      return { state: "failed", error: String(d?.error ?? d?.output?.error ?? "La GPU serverless falló.").slice(0, 300) };
    default:
      return { state: "running" }; // IN_QUEUE / IN_PROGRESS
  }
}

async function runpodTalkDownload(url: string): Promise<ArrayBuffer> {
  const res = await fetch(statusUrl(url.slice("rpvideo:".length)), { headers: runpodHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo bajar el video de la GPU serverless (${res.status}).`);
  const d = (await res.json().catch(() => null)) as { output?: { video?: string } } | null;
  const dataUrl = d?.output?.video;
  if (!dataUrl) throw new Error("La GPU serverless no devolvió el video.");
  const b64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const buf = Buffer.from(b64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

// ── Talking head: InfiniteTalk (photo + voice → video with natural movement) ──────

/** InfiniteTalk on the GPU — «avatar que habla» with natural head/body/hand movement (replaces
 *  Kling/MiniMax/HeyGen). Apache-2.0. `talking`: takes a face image + the recorded voice (refs) and the clip
 *  lasts as long as the audio. */
export const infiniteTalkGpu: VideoProvider = {
  id: "infinitetalk-gpu",
  label: "InfiniteTalk (GPU propia)",
  usdPerSecond: 0,
  talking: true,
  aspects: ["9:16", "1:1", "4:5"],
  // On when EITHER the serverless endpoint (preferred, scales) OR the single ComfyUI pod is configured.
  configured: () => itkServerlessOn() || gpuConfigured(),
  async submit(req: VideoRequest): Promise<Job> {
    const face = req.refs?.find((r) => r.role === "face" || r.role === "first_frame");
    const audio = req.refs?.find((r) => r.role === "audio");
    if (!face || !audio) throw new Error("Habla (GPU): faltan la foto del avatar o el audio.");
    // Serverless endpoint: hand the hosted face/voice URLs straight to the worker (it downloads them).
    if (itkServerlessOn()) return { provider: this.id, jobId: await runpodSubmitTalk(req, face.url, audio.url) };
    // Single pod (ComfyUI): upload the refs and submit the workflow directly.
    const [w, h] = dims(req.aspect);
    const image = await uploadRef(face.url, "image");
    const voice = await uploadRef(audio.url, "audio");
    // InfiniteTalk runs at 25 fps; num_frames follows the voice length (clamped so a bad duration can't hang the GPU).
    const frames = Math.min(500, Math.max(25, Math.round((req.seconds || 5) * 25)));
    const workflow = buildWorkflow("infinitetalk", { PROMPT: req.prompt || "a person talking to the camera, natural gestures", WIDTH: px(w), HEIGHT: px(h), FRAMES: frames, IMAGE: image, AUDIO: voice, SEED: seed() });
    return { provider: this.id, jobId: await submitWorkflow(workflow, "Habla (GPU)") };
  },
  async status(job: Job): Promise<JobStatus> {
    if (job.jobId.startsWith("rp:")) return runpodTalkStatus(job.jobId);
    const r = await pollHistory(job.jobId);
    if (!r.done) return { state: "running" };
    if (r.error) return { state: "failed", error: r.error };
    const f = firstFile(r.outputs);
    return f ? { state: "done", url: viewUrl(f) } : { state: "failed", error: "Habla (GPU): la GPU no devolvió un video." };
  },
  download: (url: string) => (url.startsWith("rpvideo:") ? runpodTalkDownload(url) : fetchBytes(url)),
};
