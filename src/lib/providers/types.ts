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
  submit(req: ImageRequest): Promise<Job>;
  status(job: Job): Promise<JobStatus>;
}

export interface VoiceProvider {
  id: string; // e.g. "elevenlabs"
  configured(): boolean;
  /** Clones a voice from a consented sample; returns the provider's voice id. */
  clone(name: string, sampleUrl: string): Promise<string>;
  /** Reads a line with a voice; returns an audio URL. */
  speak(voiceId: string, text: string): Promise<string>;
}

export interface TextAI {
  id: string; // e.g. "claude"
  configured(): boolean;
  /** One prompt in, text out. Images (frames, contact sheets) are optional. */
  complete(opts: { system?: string; prompt: string; images?: string[]; json?: boolean }): Promise<string>;
}
