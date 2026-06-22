"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const PdfViewer = lazy(() => import("./PdfViewer"));
const PptxViewer = lazy(() => import("./PptxViewer"));

type Kind = "pdf" | "pptx" | "unknown";

type Props = {
  driveId: string;
  page: number;
  onLoad: (numPages: number) => void;
};

function detectKind(contentType: string, disposition: string | null): Kind {
  const ct = contentType.toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (
    ct.includes("presentationml") ||
    ct.includes("powerpoint") ||
    ct.includes("vnd.ms-powerpoint")
  ) {
    return "pptx";
  }
  const name = (disposition || "").toLowerCase();
  if (name.includes(".pdf")) return "pdf";
  if (name.includes(".pptx") || name.includes(".ppt")) return "pptx";
  return "unknown";
}

export default function DocViewer({ driveId, page, onLoad }: Props) {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [kind, setKind] = useState<Kind>("unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setKind("unknown");
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/public/drive/${driveId}`);
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const ct = res.headers.get("content-type") ?? "";
        const cd = res.headers.get("content-disposition");
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        let k = detectKind(ct, cd);
        if (k === "unknown") {
          // sniff magic bytes
          const head = new Uint8Array(buf.slice(0, 4));
          if (
            head[0] === 0x25 &&
            head[1] === 0x50 &&
            head[2] === 0x44 &&
            head[3] === 0x46
          )
            k = "pdf";
          else if (head[0] === 0x50 && head[1] === 0x4b) k = "pptx"; // zip → assume pptx
        }
        setKind(k);
        setData(buf);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Load failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [driveId]);

  if (error) {
    return (
      <div className="px-6 py-20 text-center text-red-300">
        <p>Couldn't load this document.</p>
        <p className="mt-1 text-xs opacity-70">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-white/60">Downloading…</div>;
  }

  if (kind === "pdf") {
    return (
      <Suspense
        fallback={<div className="text-sm text-white/60">Loading viewer…</div>}
      >
        <PdfViewer data={data} page={page} onLoad={onLoad} />
      </Suspense>
    );
  }

  if (kind === "pptx") {
    return (
      <Suspense
        fallback={<div className="text-sm text-white/60">Loading viewer…</div>}
      >
        <PptxViewer data={data} page={page} onLoad={onLoad} />
      </Suspense>
    );
  }

  return <div className="text-sm text-white/60">Unsupported file type.</div>;
}
