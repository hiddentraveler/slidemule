"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import Peer, { type DataConnection } from "peerjs";
import QRCode from "qrcode";
import "@/lib/pdf-setup";

type RemoteMessage =
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; page: number }
  | { type: "fullscreen" }
  | { type: "hello" };

type PresenterState = {
  page: number;
  total: number;
  fileName: string | null;
};

export default function Presenter() {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string | ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [pageWidth, setPageWidth] = useState<number>(0);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connsRef = useRef<Set<DataConnection>>(new Set());
  const pageRef = useRef(page);
  const totalRef = useRef(numPages);
  const fileNameRef = useRef<string | null>(null);

  pageRef.current = page;
  totalRef.current = numPages;
  fileNameRef.current = file?.name ?? null;

  const broadcastState = useCallback(() => {
    const payload: { type: "state" } & PresenterState = {
      type: "state",
      page: pageRef.current,
      total: totalRef.current,
      fileName: fileNameRef.current,
    };
    connsRef.current.forEach((c) => {
      if (c.open) c.send(payload);
    });
  }, []);

  // Init peer
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", async (id) => {
      setSessionId(id);
      const url = `${window.location.origin}/control?id=${id}`;
      const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
      setQrDataUrl(qr);
    });

    peer.on("connection", (conn) => {
      connsRef.current.add(conn);
      conn.on("open", () => {
        setRemoteConnected(true);
        broadcastState();
      });
      conn.on("data", (raw) => {
        const msg = raw as RemoteMessage;
        if (msg.type === "next") {
          setPage((p) => Math.min(totalRef.current || p, p + 1));
        } else if (msg.type === "prev") {
          setPage((p) => Math.max(1, p - 1));
        } else if (msg.type === "goto") {
          setPage(Math.max(1, Math.min(totalRef.current || 1, msg.page)));
        } else if (msg.type === "fullscreen") {
          stageRef.current?.requestFullscreen?.();
        } else if (msg.type === "hello") {
          broadcastState();
        }
      });
      conn.on("close", () => {
        connsRef.current.delete(conn);
        if (connsRef.current.size === 0) setRemoteConnected(false);
      });
    });

    return () => {
      peer.destroy();
    };
  }, [broadcastState]);

  // Broadcast on state changes
  useEffect(() => {
    broadcastState();
  }, [page, numPages, file, broadcastState]);

  // Stage width for responsive page rendering
  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setPageWidth(Math.floor(e.contentRect.width));
      }
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [file]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        setPage((p) => Math.min(totalRef.current || p, p + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setPage((p) => Math.max(1, p - 1));
      } else if (e.key.toLowerCase() === "f") {
        stageRef.current?.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPage(1);
    setNumPages(0);
    const reader = new FileReader();
    reader.onload = () => setFileData(reader.result);
    reader.readAsArrayBuffer(f);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            PDF Presenter
          </h1>
          <p className="text-xs text-muted-foreground">
            Drop a PDF, scan the QR with your phone, present hands-free.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {file ? "Replace PDF" : "Open PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            onClick={() => stageRef.current?.requestFullscreen?.()}
            disabled={!file}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
          >
            Fullscreen
          </button>
        </div>
      </header>

      <main className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <section
          ref={stageRef}
          className="relative flex min-h-[60vh] items-center justify-center overflow-hidden rounded-lg bg-black"
        >
          {fileData ? (
            <Document
              file={fileData}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div className="text-white/70">Loading PDF…</div>}
              error={<div className="text-red-400">Failed to load PDF.</div>}
            >
              <Page
                pageNumber={page}
                width={pageWidth || undefined}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </Document>
          ) : (
            <div className="px-6 py-20 text-center text-white/60">
              <p className="text-lg">No PDF loaded</p>
              <p className="mt-1 text-sm">Click "Open PDF" to begin.</p>
            </div>
          )}

          {file && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-sm text-white">
              {page} / {numPages || "…"}
            </div>
          )}
        </section>

        <aside className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Phone Remote
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Scan with your phone camera to open the controls.
            </p>
          </div>

          <div className="flex items-center justify-center rounded-md bg-white p-3">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Remote control QR code"
                className="h-56 w-56"
              />
            ) : (
              <div className="h-56 w-56 animate-pulse rounded bg-muted" />
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  remoteConnected ? "bg-green-500" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-muted-foreground">
                {remoteConnected ? "Remote connected" : "Waiting for remote…"}
              </span>
            </div>
            {sessionId && (
              <p className="break-all text-muted-foreground">
                Or open:{" "}
                <span className="font-mono text-foreground">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/control?id=${sessionId}`
                    : ""}
                </span>
              </p>
            )}
          </div>

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            Keyboard: ← / → to change page, F for fullscreen.
          </div>
        </aside>
      </main>
    </div>
  );
}
