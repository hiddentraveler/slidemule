"use client";

import { useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";

type StateMsg = {
  type: "state";
  page: number;
  total: number;
  fileName: string | null;
};

export default function Controller({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [state, setState] = useState<StateMsg | null>(null);
  const [gotoInput, setGotoInput] = useState("");
  const connRef = useRef<DataConnection | null>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setStatus("connecting");
    const peer = new Peer();
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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-lg font-semibold">PDF Remote</h1>
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
        {state?.fileName && (
          <p className="mt-2 truncate text-sm text-muted-foreground">
            📄 {state.fileName}
          </p>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-6 p-5">
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Page
          </div>
          <div className="mt-1 text-5xl font-bold">
            {state?.page ?? "—"}
            <span className="text-2xl text-muted-foreground">
              {" "}
              / {state?.total ?? "—"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => send({ type: "prev" })}
            disabled={status !== "connected"}
            className="rounded-lg bg-secondary py-8 text-2xl font-semibold text-secondary-foreground active:scale-95 disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            onClick={() => send({ type: "next" })}
            disabled={status !== "connected"}
            className="rounded-lg bg-primary py-8 text-2xl font-semibold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            Next →
          </button>
        </div>

        <button
          onClick={() => send({ type: "fullscreen" })}
          disabled={status !== "connected"}
          className="rounded-lg border border-border py-4 text-sm font-medium hover:bg-accent disabled:opacity-40"
        >
          Fullscreen presenter
        </button>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(gotoInput, 10);
            if (!Number.isNaN(n)) send({ type: "goto", page: n });
            setGotoInput("");
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={state?.total ?? undefined}
            value={gotoInput}
            onChange={(e) => setGotoInput(e.target.value)}
            placeholder="Go to page…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-3 text-base"
          />
          <button
            type="submit"
            disabled={status !== "connected" || !gotoInput}
            className="rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Go
          </button>
        </form>

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
