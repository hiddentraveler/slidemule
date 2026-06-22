export type SheetDoc = { id: string; name: string; driveId: string };

function extractSheetInfo(
  url: string,
): { sheetId: string; gid: string } | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  return { sheetId: m[1], gid: gidMatch?.[1] ?? "0" };
}

function extractDriveId(s: string): string | null {
  if (!s) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]{20,})/,
    /[?&]id=([a-zA-Z0-9-_]{20,})/,
    /\/d\/([a-zA-Z0-9-_]{20,})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

// Tiny CSV parser that handles quoted fields with commas/newlines.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (c === "\r") {
        // skip
      } else {
        field += c;
      }
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

export async function fetchSheetDocs(sheetUrl: string): Promise<SheetDoc[]> {
  const info = extractSheetInfo(sheetUrl);
  if (!info) throw new Error("Not a Google Sheets URL");
  const csvUrl = `https://docs.google.com/spreadsheets/d/${info.sheetId}/gviz/tq?tqx=out:csv&gid=${info.gid}`;
  const res = await fetch(csvUrl);
  if (!res.ok)
    throw new Error(
      "Failed to fetch sheet — make sure it's shared as 'Anyone with the link'.",
    );
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  // Find a column with a drive link by scanning data rows
  let linkCol = -1;
  for (let c = 0; c < header.length; c++) {
    for (let r = 1; r < Math.min(rows.length, 6); r++) {
      if (rows[r][c] && extractDriveId(rows[r][c])) {
        linkCol = c;
        break;
      }
    }
    if (linkCol >= 0) break;
  }
  if (linkCol < 0)
    throw new Error("No Google Drive links found in this sheet.");

  // Pick a name column: prefer a header containing "name", else first non-link text col
  let nameCol = header.findIndex((h) => h.includes("name"));
  if (nameCol < 0) {
    for (let c = 0; c < header.length; c++) {
      if (c === linkCol) continue;
      const v = rows[1]?.[c] ?? "";
      if (v && !extractDriveId(v) && isNaN(Date.parse(v)) && isNaN(Number(v))) {
        nameCol = c;
        break;
      }
    }
  }

  const docs: SheetDoc[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const cell = rows[r][linkCol];
    const driveId = cell ? extractDriveId(cell) : null;
    if (!driveId || seen.has(driveId)) continue;
    seen.add(driveId);
    const name =
      (nameCol >= 0 ? rows[r][nameCol] : "") || `Document ${docs.length + 1}`;
    docs.push({ id: driveId, name: name.trim(), driveId });
  }
  return docs;
}
