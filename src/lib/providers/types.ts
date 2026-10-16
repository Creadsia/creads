// The model layer: every outside AI service Creads uses sits behind one of these interfaces,
// so a provider can be swapped (Veo ⇄ Seedance ⇄ Kling) without touching the rest of the app.

export type AspectRatio = "9:16" | "1:1" | "4:5" | "16:9";

/** A reference passed to a generator: a face, a product, a voice sample. */
export interface MediaRef {
  url: string;
  role: "face" | "product" | "first_frame" | "audio";
}

/** A long-running generation. Video and image providers answer with a job, then we poll it. */
export interface Job {
  provider: string;
  jobId: string;
}

export type JobStatus =
  | { state: "queued" | "running" }
  | { state: "done"; url: string; seconds?: number }
  | { state: "failed"; error: string };

export interface VideoRequest {
  prompt: string;
  seconds: number; // most models cap a clip at 8–10 s
  aspect: AspectRatio;
  resolution: "720p" | "1080p";
  withAudio: boolean; // the person speaks the line in the clip
  refs?: MediaRef[];
}

export interface VideoProvider {
  id: string; // e.g. "veo-3.1-fast", "seedance-2.0"
  label: string;
  /** Approximate US$ per generated second, used for credit pricing and the cost panel. */
  usdPerSecond: number;
  configured(): boolean;
  submit(req: VideoRequest): Promise<Job>;
  status(job: Job): Promise<JobStatus>;
  /** Formats and lengths the model accepts (the studio only offers these). */
  aspects?: AspectRatio[];
  durations?: number[];
  /** True when the model can only animate a starting image (no text-only clips). */
  needsImage?: boolean;
  /** True when the clip has no sound (can't be used for scenes where someone talks). */
  silent?: boolean;
  /** For providers whose result links need our key (Veo): fetch the finished file so we can re-host it. */
  download?(url: string): Promise<ArrayBuffer>;
}

export interface ImageRequest {
  prompt: string;
  aspect: AspectRatio;
  refs?: MediaRef[];
}

export interface ImageProvider {
  id: string; // e.g. "nano-banana-pro"
  label: string;
  usdPerImage: number;
  configured(): boolean;
  /** Images take seconds, so this waits for the result and returns the file. */
  generate(req: ImageRequest): Promise<{ bytes: Uint8Array; mime: string }>;
}

export interface Voice {
  id: string;
  name: string;
  category: string; // "cloned" = the customer's own; "premade"/"professional" = library voices
  preview?: string;
  labels?: Record<string, string>;
}

export interface VoiceProvider {
  id: string; // e.g. "elevenlabs"
  configured(): boolean;
  /** Voices available on our account (cloned ones first). */
  voices(): Promise<Voice[]>;
  /** Clones a voice from a consented sample; returns the provider's voice id. */
  clone(name: string, sample: { bytes: Uint8Array; mime: string; filename: string }): Promise<string>;
  /** Reads a line with a voice; returns the audio file. */
  speak(voiceId: string, text: string, opts?: { model?: string; lang?: "en" | "es" }): Promise<{ bytes: Uint8Array; mime: string }>;
  /** Word-level transcript of a hosted audio or video file. */
  transcribe?(url: string, lang?: "en" | "es"): Promise<{ text: string; words: { w: string; s: number; e: number }[] }>;
  /** Characters used and included in the current plan period. */
  usage?(): Promise<{ used: number; limit: number; tier: string }>;
}

export interface TextAI {
  id: string; // e.g. "claude"
  configured(): boolean;
  /** One prompt in, text out. Images (frames, contact sheets) are optional. */
  complete(opts: { system?: string; prompt: string; images?: string[]; json?: boolean }): Promise<string>;
}
