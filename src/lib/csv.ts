// CSV för svenska Excel: semikolon som avgränsare, CRLF och UTF-8 med BOM
// så att å, ä och ö visas rätt när filen öppnas med dubbelklick.

function cell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  // Skydd mot formelinjektion: celler som Excel skulle tolka som formel.
  // Telefonnummer som "+46 70…" lämnas orörda.
  if (/^[=@\t\r]/.test(s) || /^[+-](?![0-9 ])/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
