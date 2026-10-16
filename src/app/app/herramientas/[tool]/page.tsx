import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findTool } from "@/lib/tools";
import ToolRun from "../../_parts/tool-run";
import { PageHead } from "../../_parts/ui";

type Props = { params: Promise<{ tool: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = findTool((await params).tool);
  return { title: t?.name ?? "Herramienta" };
}

const one = (v: string | string[] | undefined) => (typeof v === "string" && v.startsWith("https://") ? v : undefined);

export default async function ToolPage({ params, searchParams }: Props) {
  const t = findTool((await params).tool);
  if (!t) notFound();
  const q = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/app/herramientas" className="w-fit text-sm text-muted hover:text-ink">← Herramientas IA</Link>
        <PageHead title={t.name} lead={t.lead}>
          <span className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted">{t.model}</span>
        </PageHead>
      </div>
      <ToolRun key={t.id} toolId={t.id} initial={{ image: one(q.image), video: one(q.video) }} />
    </>
  );
}
