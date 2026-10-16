import type { Metadata } from "next";
import Link from "next/link";
import AdWork from "../../_parts/ad-work";

export const metadata: Metadata = { title: "Anuncio" };

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Link href="/app/videos" className="text-sm text-muted hover:text-ink">← Videos</Link>
      <AdWork adId={id} />
    </>
  );
}
