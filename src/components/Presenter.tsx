"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import QRCode from "qrcode";
import { fetchSheetDocs, type SheetDoc } from "@/lib/sheet";
import DocViewer from "./DocViewer";

type RemoteMessage =
  | { type: "select"; docId: string }
  | { type: "page"; delta: number }
  | { type: "page-set"; page: number }
  | { type: "fullscreen" }
  | { type: "hello" };

type PresenterState = {
  type: "state";
  docs: SheetDoc[];
  currentId: string | null;
  page: number;
  numPages: number;
};

export default function Presenter() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [docs, setDocs] = useState<SheetDoc[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);

  const [filter, setFilter] = useState("");

  const stageRef = useRef<HTMLDivElement | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connsRef = useRef<Set<DataConnection>>(new Set());

  const stateRef = useRef({ docs, currentId, page, numPages });
  stateRef.current = { docs, currentId, page, numPages };

  const broadcastState = useCallback(() => {
    const s = stateRef.current;
    const payload: PresenterState = {
      type: "state",
      docs: s.docs,
      currentId: s.currentId,
      page: s.page,
      numPages: s.numPages,
    };
    connsRef.current.forEach((c) => {
      if (c.open) c.send(payload);
    });
  }, []);

  const changePage = useCallback((delta: number) => {
    setPage((p) => {
      const max = stateRef.current.numPages || 1;
      const next = Math.min(max, Math.max(1, p + delta));
      return next;
    });
  }, []);

  useEffect(() => {
    const peer = new Peer({
      config: {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      },
    });
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
        if (msg.type === "select") {
          setCurrentId(msg.docId);
          setPage(1);
          setNumPages(0);
        } else if (msg.type === "page") {
          changePage(msg.delta);
        } else if (msg.type === "page-set") {
          setPage(Math.max(1, msg.page));
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
  }, [broadcastState, changePage]);

  useEffect(() => {
    broadcastState();
  }, [docs, currentId, page, numPages, broadcastState]);

  // Keyboard nav on presenter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        changePage(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        changePage(-1);
      } else if (e.key === "f" || e.key === "F") {
        stageRef.current?.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changePage]);

  const loadSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSheetDocs(sheetUrl);
      setDocs(list);
      if (list.length && !currentId) {
        setCurrentId(list[0].id);
        setPage(1);
        setNumPages(0);
      }
      if (!list.length) setError("No PDF links found in sheet.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sheet");
    } finally {
      setLoading(false);
    }
  };

  const currentDoc = docs.find((d) => d.id === currentId) ?? null;

  const handleLoad = useCallback((n: number) => {
    setNumPages(n);
    setPage((p) => Math.min(Math.max(1, p), n));
  }, []);

  const filtered = filter
    ? docs.filter((d) => d.name.toLowerCase().includes(filter.toLowerCase()))
    : docs;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">SlideMule</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="w-80 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={loadSheet}
            disabled={!sheetUrl || loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {loading ? "Loading…" : "Load"}
          </button>
          <button
            onClick={() => stageRef.current?.requestFullscreen?.()}
            disabled={!currentDoc}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
          >
            Fullscreen
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <main className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <section
          ref={stageRef}
          className="relative flex min-h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-black"
        >
          {currentDoc ? (
            <DocViewer
              key={currentDoc.id}
              driveId={currentDoc.driveId}
              page={page}
              onLoad={handleLoad}
            />
          ) : (
            <div className="px-6 py-20 text-center text-white/60">
              <p className="text-lg">No document selected</p>
              <p className="mt-1 text-sm">
                Load a sheet, then pick a doc from your phone.
              </p>
            </div>
          )}

          {currentDoc && (
            <>
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1 text-sm text-white">
                {currentDoc.name} · {page}/{numPages || "…"}
              </div>
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={() => changePage(-1)}
                  className="rounded-md bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
                >
                  ‹ Prev
                </button>
                <button
                  onClick={() => changePage(1)}
                  className="rounded-md bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
                >
                  Next ›
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="flex h-[80vh] flex-col space-y-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Phone Remote
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Scan to flip pages and switch documents from your phone.
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

          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Search documents…`}
            className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
          />

          <ul className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filtered.length === 0 && (
              <li className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {docs.length === 0
                  ? "Load a sheet to see documents."
                  : "No matches."}
              </li>
            )}

            {filtered.map((d) => {
              const active = d.id === currentId;

              return (
                <li key={d.id}>
                  <button
                    onClick={() => {
                      setCurrentId(d.id);
                      setPage(1);
                      setNumPages(0);
                    }}
                    className={`w-full rounded-lg border px-4 py-4 text-left text-sm font-medium transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    <div className="truncate">{d.name}</div>

                    {active && (
                      <div className="mt-1 text-xs opacity-80">
                        Currently Presenting
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </main>
    </div>
  );
}
