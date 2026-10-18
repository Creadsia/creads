import type { Metadata } from "next";
import { FullOnly } from "../_parts/full-only";
import { PageHead } from "../_parts/ui";
import Recrear from "./recrear";

export const metadata: Metadata = { title: "Recrear video" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// only our own media links (the server checks they are the customer's when the job starts)
const media = (v: string | string[] | undefined) => (typeof v === "string" && v.startsWith("/api/media/ws/") && !v.includes("..") ? v : undefined);

export default async function RecrearPage({ searchParams }: Props) {
  const q = await searchParams;
  const video = media(q.video);
  const mode = q.modo === "copiar-movimiento" ? "copiar-movimiento" : q.modo === "editar-video" ? "editar-video" : undefined;
  const prompt = typeof q.prompt === "string" ? q.prompt.slice(0, 600) : undefined;
  // «Recrear con mi personaje» (from Influencer IA): the character's sheet, its name, and whether the result is silent
  const personaje = media(q.personaje);
  const nombre = personaje && typeof q.nombre === "string" ? q.nombre.slice(0, 60) : undefined;
  const sound = q.audio === "0" ? false : undefined;
  return (
    <>
      <PageHead title="Recrear video" lead="Toma un video que funciona y hazlo tuyo: cambia la persona, el producto o el lugar, o haz que tu personaje copie sus mismos movimientos." />
      <FullOnly><Recrear key={`${video ?? ""}|${mode ?? ""}|${personaje ?? ""}`} video={video} mode={mode} prompt={prompt} personaje={personaje ? { sheet: personaje, nombre } : undefined} sound={sound} /></FullOnly>
    </>
  );
}
