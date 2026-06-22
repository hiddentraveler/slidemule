import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    return new Response("Bad id", { status: 400 });
  }

  const tryFetch = async (url: string) =>
    fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0",
      },
    });

  let res = await tryFetch(
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
  );

  // If we get HTML (virus scan warning), try alternate endpoint
  const ct = res.headers.get("content-type") ?? "";

  if (!res.ok || ct.includes("text/html")) {
    res = await tryFetch(
      `https://drive.google.com/uc?export=download&id=${id}`,
    );
  }

  if (!res.ok || !res.body) {
    return new Response("Failed to fetch from Drive", {
      status: 502,
    });
  }

  const headers = new Headers();

  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);

  const length = res.headers.get("content-length");
  if (length) headers.set("content-length", length);

  headers.set("cache-control", "public, max-age=3600");
  headers.set("access-control-allow-origin", "*");

  return new Response(res.body, {
    status: 200,
    headers,
  });
}
