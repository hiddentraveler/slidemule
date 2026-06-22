"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "@/lib/pdf-setup";

type Props = {
  data: ArrayBuffer;
  page: number;
  onLoad: (numPages: number) => void;
};

export default function PdfViewer({ data, page, onLoad }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // react-pdf mutates the buffer; clone to keep ours intact across re-renders
  const file = useMemo(() => ({ data: data.slice(0) }), [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center"
    >
      {size.w > 0 && (
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => onLoad(numPages)}
          loading={<div className="text-white/70 text-sm">Loading PDF…</div>}
          error={
            <div className="text-red-400 text-sm">Failed to load PDF.</div>
          }
        >
          <Page
            pageNumber={page}
            width={size.w}
            height={size.h}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            canvasBackground="white"
          />
        </Document>
      )}
    </div>
  );
}
