import { deflate, inflate } from "pako";
import type { AppStateSnapshot, Feed, Folder, UserLabel, AppSettings } from "./types";

export type SharePayload =
  | { kind: "feed"; version: 1; feed: Feed }
  | { kind: "folder"; version: 1; folder: Folder }
  | { kind: "settings"; version: 1; settings: Partial<AppSettings> }
  | { kind: "labels"; version: 1; labels: UserLabel[] }
  | { kind: "full"; version: 1; snapshot: AppStateSnapshot };

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeSharePayload(payload: SharePayload) {
  const text = JSON.stringify(payload);
  return toBase64Url(deflate(text));
}

export function decodeSharePayload(encoded: string): SharePayload {
  const inflated = inflate(fromBase64Url(encoded), { to: "string" });
  return JSON.parse(inflated) as SharePayload;
}

export function makeShareUrl(payload: SharePayload) {
  const encoded = encodeSharePayload(payload);
  const url = new URL(window.location.href);
  url.hash = `#/import?p=${encoded}`;
  return url.toString();
}

export function exportCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
