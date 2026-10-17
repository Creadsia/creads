import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findTool } from "@/lib/tools";
import ToolRun from "../../_parts/tool-run";
import { FullOnly } from "../../_parts/full-only";
import { PageHead } from "../../_parts/ui";

type Props = { params: Promise<{ tool: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = findTool((await params).tool);
  return { title: t?.name ?? "Herramienta" };
}

// a file passed from another tool: only our own media links (the server checks they are the customer's)
const one = (v: string | string[] | undefined) => (typeof v === "string" && v.startsWith("/api/media/ws/") && !v.includes("..") ? v : undefined);

export default async function ToolPage({ params, searchParams }: Props) {
  const t = findTool((await params).tool);
  if (!t) notFound();
  const q = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-2">
        <PageHead title={t.name} lead={t.lead}>
          <span className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted">{t.model}</span>
        </PageHead>
      </div>
      <FullOnly><ToolRun key={t.id} toolId={t.id} initial={{ image: one(q.image), video: one(q.video), prompt: typeof q.prompt === "string" ? q.prompt.slice(0, 600) : undefined }} /></FullOnly>
    </>
  );
}
