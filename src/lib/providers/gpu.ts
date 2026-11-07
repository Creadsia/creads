import type { ImageProvider, ImageRequest, Job, JobStatus, VideoProvider, VideoRequest } from "./types";

// Self-hosted GPU (ComfyUI) provider. Replaces the paid frame/B-roll providers (Nano Banana, fal.ai) with
// FLUX (images) and Wan 2.2 (B-roll) running on our own rented or owned GPU, so a generation costs ~the
// electricity/hour, not a per-second API fee, and doesn't depend on any third-party balance.
//
// This talks to a plain ComfyUI server over its HTTP API (NOT api.comfy.org — that's `comfy.ts`):
//   POST /prompt            {prompt: <workflow>, client_id}  -> {prompt_id}
//   GET  /history/{id}                                       -> {<id>: {outputs: {<node>: {images|gifs: [...]}}}}
//   GET  /view?filename=..&subfolder=..&type=output          -> the file bytes
// The ad pipeline re-hosts whatever url we return (clips/status saveMedia), so we hand back a /view url on
// the GPU and, for images, the bytes directly.
//
// Config (Vercel env):
//   GPU_ENABLED=1            turns these providers on (off by default — production untouched until set).
//   GPU_COMFY_URL=https://<pod>-8188.proxy.runpod.net   the ComfyUI base url (rented pod, or a fixed endpoint).
//   GPU_COMFY_TOKEN=...      optional bearer token if the endpoint is protected.
// The two workflows below use the exact model filenames validated on the pod (Wan 2.2 14B fp16 + the
// lightx2v 4-step LoRAs, and FLUX.1). Keep them in sync with what's installed on the GPU; a filename the
// server doesn't have makes the job fail with a clear "model not found" from ComfyUI.

export const gpuConfigured = () =>
  process.env.GPU_ENABLED === "1" && /^https?:\/\/[^\s]+$/.test((process.env.GPU_COMFY_URL ?? "").trim());

const base = () => (process.env.GPU_COMFY_URL ?? "").trim().replace(/\/+$/, "");
const headers = () => {
  const h: Record<string, string> = { "content-type": "application/json" };
  const t = (process.env.GPU_COMFY_TOKEN ?? "").trim();
  if (t) h.authorization = `Bearer ${t}`;
  return h;
};

/** Queue a workflow (API format). Returns ComfyUI's prompt_id. */
async function submitWorkflow(workflow: Record<string, unknown>, what: string): Promise<string> {
  const res = await fetch(`${base()}/prompt`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prompt: workflow, client_id: `creads-${Date.now().toString(36)}` }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("gpu submit", res.status, detail.slice(0, 300));
    throw new Error(`${what}: la GPU rechazó el trabajo (${res.status}). Revisa que ComfyUI esté prendido y los modelos instalados.`);
  }
  const d = (await res.json().catch(() => null)) as { prompt_id?: string; error?: unknown } | null;
  if (!d?.prompt_id) throw new Error(`${what}: la GPU no devolvió un trabajo (¿ComfyUI apagado?).`);
  return d.prompt_id;
}

type Outputs = Record<string, { images?: ComfyFile[]; gifs?: ComfyFile[]; videos?: ComfyFile[] }>;
type ComfyFile = { filename: string; subfolder?: string; type?: string };

/** Poll one job. While it's absent from /history it is still queued/running. */
async function pollHistory(id: string): Promise<{ done: false } | { done: true; outputs: Outputs; error?: string }> {
  const res = await fetch(`${base()}/history/${id}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return { done: false };
  const hist = (await res.json().catch(() => null)) as Record<string, { outputs?: Outputs; status?: { status_str?: string; messages?: unknown } }> | null;
  const entry = hist?.[id];
  if (!entry) return { done: false }; // not finished yet
  if (entry.status?.status_str === "error") return { done: true, outputs: {}, error: "La GPU falló al generar (revisa el workflow/los modelos)." };
  return { done: true, outputs: entry.outputs ?? {} };
}

/** First media file across all output nodes (SaveImage / SaveVideo / VHS). */
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

// ──────────────────────────────────────────────────────────────────────────────
// Workflows (ComfyUI API format). Validated filenames on the RunPod "one-click Wan" pod.
// NOTE: export these from ComfyUI with "Save (API Format)" after any change on the GPU and paste them here;
// the structure below mirrors the validated graph but must be confirmed on staging before going to main.

const px = (n: number) => Math.round(n / 16) * 16; // ComfyUI wants multiples of 16

/** FLUX.1 text-to-image (schnell, 4 steps). Core ComfyUI nodes. */
function fluxWorkflow(prompt: string, w: number, h: number): Record<string, unknown> {
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: "flux1-schnell.safetensors", weight_dtype: "fp8_e4m3fn" } },
    "2": { class_type: "DualCLIPLoader", inputs: { clip_name1: "clip_l.safetensors", clip_name2: "t5xxl_fp8_e4m3fn.safetensors", type: "flux" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    "5": { class_type: "EmptySD3LatentImage", inputs: { width: px(w), height: px(h), batch_size: 1 } },
    "6": { class_type: "KSampler", inputs: { seed: Math.floor(Math.random() * 1e15), steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1, model: ["1", 0], positive: ["4", 0], negative: ["4", 0], latent_image: ["5", 0] } },
    "7": { class_type: "VAEDecode", inputs: { samples: ["6", 0], vae: ["3", 0] } },
    "8": { class_type: "SaveImage", inputs: { filename_prefix: "creads_flux", images: ["7", 0] } },
  };
}

/** Wan 2.2 14B text-to-video (B-roll, silent), dual high/low-noise models + 4-step lightx2v LoRAs. */
function wanWorkflow(prompt: string, w: number, h: number, seconds: number): Record<string, unknown> {
  const frames = Math.min(81, Math.max(17, Math.round(seconds * 16) + 1)); // 16 fps
  const neg = "blurry, low quality, distorted, watermark, text";
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: "wan2.2_t2v_high_noise_14B_fp16.safetensors", weight_dtype: "default" } },
    "2": { class_type: "UNETLoader", inputs: { unet_name: "wan2.2_t2v_low_noise_14B_fp16.safetensors", weight_dtype: "default" } },
    "3": { class_type: "LoraLoaderModelOnly", inputs: { lora_name: "wan2.2_t2v_A14b_high_noise_lora_rank64_lightx2v_4step_1217.safetensors", strength_model: 1, model: ["1", 0] } },
    "4": { class_type: "LoraLoaderModelOnly", inputs: { lora_name: "wan2.2_t2v_A14b_low_noise_lora_rank64_lightx2v_4step_1217.safetensors", strength_model: 1, model: ["2", 0] } },
    "5": { class_type: "CLIPLoader", inputs: { clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", type: "wan" } },
    "6": { class_type: "VAELoader", inputs: { vae_name: "wan_2.1_vae.safetensors" } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["5", 0] } },
    "8": { class_type: "CLIPTextEncode", inputs: { text: neg, clip: ["5", 0] } },
    "9": { class_type: "EmptyHunyuanLatentVideo", inputs: { width: px(w), height: px(h), length: frames, batch_size: 1 } },
    // High-noise pass (steps 0-2), then low-noise pass (steps 2-4): the 4-step lightx2v recipe.
    "10": { class_type: "KSamplerAdvanced", inputs: { add_noise: "enable", noise_seed: Math.floor(Math.random() * 1e15), steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", start_at_step: 0, end_at_step: 2, return_with_leftover_noise: "enable", model: ["3", 0], positive: ["7", 0], negative: ["8", 0], latent_image: ["9", 0] } },
    "11": { class_type: "KSamplerAdvanced", inputs: { add_noise: "disable", noise_seed: 0, steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", start_at_step: 2, end_at_step: 4, return_with_leftover_noise: "disable", model: ["4", 0], positive: ["7", 0], negative: ["8", 0], latent_image: ["10", 0] } },
    "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["6", 0] } },
    "13": { class_type: "SaveVideo", inputs: { filename_prefix: "creads_wan", format: "mp4", codec: "h264", fps: 16, images: ["12", 0] } },
  };
}

const dims = (aspect: string): [number, number] =>
  aspect === "9:16" ? [480, 832] : aspect === "16:9" ? [832, 480] : aspect === "4:5" ? [512, 640] : [576, 576];

/** FLUX on the GPU — the opening-frame/image generator (replaces Nano Banana). */
export const fluxGpu: ImageProvider = {
  id: "flux-gpu",
  label: "FLUX (GPU propia)",
  usdPerImage: 0, // runs on our GPU; only the hour of GPU time, shared across everything generated in it
  configured: gpuConfigured,
  async generate(req: ImageRequest): Promise<{ bytes: Uint8Array; mime: string }> {
    const [w, h] = dims(req.aspect);
    const id = await submitWorkflow(fluxWorkflow(req.prompt, w, h), "Imagen (GPU)");
    // Images are quick: poll up to ~90 s.
    for (let i = 0; i < 90; i++) {
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

/** Wan 2.2 on the GPU — B-roll scenes (silent: can't be used for cuts where the person talks). */
export const wanBrollGpu: VideoProvider = {
  id: "wan-gpu",
  label: "Wan 2.2 (GPU propia)",
  usdPerSecond: 0, // our GPU; no per-second API fee
  silent: true, // text-to-video only, no lip-sync — for B-roll, never the talking head
  aspects: ["9:16", "16:9", "1:1", "4:5"],
  configured: gpuConfigured,
  async submit(req: VideoRequest): Promise<Job> {
    const [w, h] = dims(req.aspect);
    const id = await submitWorkflow(wanWorkflow(req.prompt, w, h, Math.min(5, Math.max(2, req.seconds))), "B-roll (GPU)");
    return { provider: this.id, jobId: id };
  },
  async status(job: Job): Promise<JobStatus> {
    const r = await pollHistory(job.jobId);
    if (!r.done) return { state: "running" };
    if (r.error) return { state: "failed", error: r.error };
    const f = firstFile(r.outputs);
    if (!f) return { state: "failed", error: "B-roll (GPU): la GPU no devolvió un video." };
    return { state: "done", url: viewUrl(f) };
  },
  download: (url: string) => fetchBytes(url),
};
