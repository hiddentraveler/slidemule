"use client";

import { useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { useSearchParams } from "next/navigation";

type SheetDoc = { id: string; name: string; driveId: string };
type StateMsg = {
  type: "state";
  docs: SheetDoc[];
  currentId: string | null;
  page: number;
  numPages: number;
};

export default function Controller() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [state, setState] = useState<StateMsg | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setStatus("connecting");
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

    peer.on("open", () => {
      const conn = peer.connect(sessionId, { reliable: true });
      connRef.current = conn;
      conn.on("open", () => {
        setStatus("connected");
        conn.send({ type: "hello" });
      });
      conn.on("data", (raw) => {
        const msg = raw as StateMsg;
        if (msg.type === "state") setState(msg);
      });
      conn.on("close", () => setStatus("error"));
      conn.on("error", () => setStatus("error"));
    });

    peer.on("error", () => setStatus("error"));

    return () => {
      peer.destroy();
    };
  }, [sessionId]);

  const send = (msg: unknown) => {
    const c = connRef.current;
    if (c && c.open) c.send(msg);
  };

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <p className="text-muted-foreground">
          Missing session id. Scan the QR code from the presenter screen.
        </p>
      </div>
    );
  }

  const docs = state?.docs ?? [];
  const current = docs.find((d) => d.id === state?.currentId) ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-lg font-semibold">Doc Remote</h1>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "bg-yellow-500"
                  : status === "error"
                    ? "bg-red-500"
                    : "bg-muted-foreground/40"
            }`}
          />
          <span className="text-muted-foreground capitalize">{status}</span>
        </div>
        {current && (
          <p className="mt-2 truncate text-sm">
            <span className="text-muted-foreground">Now: </span>
            <span className="font-medium">{current.name}</span>
            {state && state.numPages > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · page {state.page}/{state.numPages}
              </span>
            )}
          </p>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => send({ type: "page", delta: -1 })}
            disabled={status !== "connected" || !current}
            className="rounded-lg bg-secondary py-8 text-xl font-semibold text-secondary-foreground active:scale-95 disabled:opacity-40"
          >
            ← Prev page
          </button>
          <button
            onClick={() => send({ type: "page", delta: 1 })}
            disabled={status !== "connected" || !current}
            className="rounded-lg bg-primary py-8 text-xl font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            Next page →
          </button>
        </div>

        {status === "error" && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Connection lost. Make sure the presenter screen is still open, then
            reload this page.
          </p>
        )}
      </main>
    </div>
  );
}
