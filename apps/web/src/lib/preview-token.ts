/* Client-side decode of the link-page preview token's payload (no signature
   check — the server verifies it; the client only needs page_id to open the
   WebSocket room). */
export function decodePreviewToken(token: string): { page_id?: string; sub?: string } | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
