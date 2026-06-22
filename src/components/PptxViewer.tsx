"use client";

import { useEffect, useRef } from "react";
import { init } from "pptx-preview";

type Props = {
  data: ArrayBuffer;
  page: number;
  onLoad: (numPages: number) => void;
};

export default function PptxViewer({ data, page, onLoad }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewerRef = useRef<ReturnType<typeof init> | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const rect = el.getBoundingClientRect();
    const previewer = init(el, {
      width: Math.max(800, Math.floor(rect.width)),
      height: Math.max(450, Math.floor(rect.height)),
      mode: "slide",
    });
    previewerRef.current = previewer;

    previewer
      .preview(data.slice(0))
      .then(() => {
        readyRef.current = true;
        onLoad(previewer.slideCount || 1);
        previewer.renderSingleSlide(Math.max(0, page - 1));
      })
      .catch((e: unknown) => {
        console.error("pptx preview failed", e);
      });

    return () => {
      try {
        previewer.destroy?.();
      } catch {
        /* noop */
      }
      el.innerHTML = "";
      previewerRef.current = null;
    };
  }, [data, onLoad]);

  // React to external page changes
  useEffect(() => {
    if (readyRef.current && previewerRef.current) {
      previewerRef.current.renderSingleSlide(Math.max(0, page - 1));
    }
  }, [page]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center [&_*]:max-w-full"
    />
  );
}
