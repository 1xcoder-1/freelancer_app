/**
 * Human-Friendly Text & Label Formatting
 * Transforms raw machine IDs, slugs, and cryptic hashes into intuitive labels
 * suitable for clients and non-technical freelancers.
 */

/**
 * Transforms machine-like invoice identifiers into friendly, human-readable labels.
 * E.g., "CONSULT-20261019-BFA0B9" -> "Consultation Invoice #BFA0B9"
 * E.g., "INV-20261019-001" -> "Invoice #001"
 */
export function humanizeInvoiceNumber(raw: string | null | undefined): string {
  if (!raw) return "Invoice";
  const trimmed = raw.trim();

  // Consultation auto-invoices: CONSULT-YYYYMMDD-HASH -> Consultation Invoice #HASH
  const consultMatch = trimmed.match(/^CONSULT(?:-\d+)?-([A-Za-z0-9]+)$/i);
  if (consultMatch) {
    return `Consultation Invoice #${consultMatch[1]}`;
  }

  // General date-stamped invoices: INV-YYYYMMDD-001 -> Invoice #001
  const invDateMatch = trimmed.match(/^INV-\d+-([A-Za-z0-9]+)$/i);
  if (invDateMatch) {
    return `Invoice #${invDateMatch[1]}`;
  }

  // Prefixed invoices: INV-001 -> Invoice #001
  const invPrefixMatch = trimmed.match(/^INV-([A-Za-z0-9-]+)$/i);
  if (invPrefixMatch) {
    return `Invoice #${invPrefixMatch[1]}`;
  }

  return trimmed;
}

/**
 * Humanizes notification titles and alerts, removing raw hashes and tech jargon.
 * E.g., "Invoice CONSULT-20261019-BFA0B9 is overdue" -> "Consultation Invoice #BFA0B9 is overdue"
 */
export function humanizeNotificationTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .replace(/Invoice\s+CONSULT-\d+-([A-Za-z0-9]+)/gi, "Consultation Invoice #$1")
    .replace(/Invoice\s+INV-\d+-([A-Za-z0-9]+)/gi, "Invoice #$1")
    .replace(/CONSULT-\d+-([A-Za-z0-9]+)/gi, "Consultation Invoice #$1")
    .replace(/INV-([A-Za-z0-9-]+)/gi, "Invoice #$1");
}

/**
 * Humanizes notification bodies, ensuring currency prefixes and readable grammar.
 * E.g., "100.00 was due and is still outstanding." -> "Rs 100.00 was due and is still outstanding."
 */
export function humanizeNotificationBody(
  body: string | null | undefined,
  currency: string = "Rs"
): string {
  if (!body) return "";
  // If the body starts with a raw number followed by "was due"
  const bareAmountMatch = body.match(/^([\d,]+(?:\.\d{1,2})?)\s+(was due.*)$/i);
  if (bareAmountMatch) {
    return `${currency} ${bareAmountMatch[1]} ${bareAmountMatch[2]}`;
  }
  return body;
}

/**
 * Formats calendar event titles to be clear and concise for non-developers.
 * E.g., "Invoice CONSULT-20261019-BFA0B9 due" -> "Consultation Invoice (#BFA0B9) due"
 */
export function humanizeCalendarTitle(title: string | null | undefined): string {
  if (!title) return "";
  let t = title.trim();
  // "Invoice CONSULT-20261019-BFA0B9 due" -> "Invoice #BFA0B9 (Due)"
  t = t.replace(/Invoice\s+CONSULT-\d+-([A-Za-z0-9]+)\s+due/gi, "Invoice #$1 (Due)");
  t = t.replace(/Invoice\s+INV-\d+-([A-Za-z0-9]+)\s+due/gi, "Invoice #$1 (Due)");
  t = t.replace(/Invoice\s+CONSULT-\d+-([A-Za-z0-9]+)/gi, "Invoice #$1");
  t = t.replace(/Invoice\s+INV-\d+-([A-Za-z0-9]+)/gi, "Invoice #$1");
  t = t.replace(/CONSULT-\d+-([A-Za-z0-9]+)\s+due/gi, "Consultation #$1 (Due)");
  t = t.replace(/CONSULT-\d+-([A-Za-z0-9]+)/gi, "Consultation #$1");
  t = t.replace(/INV-\d+-([A-Za-z0-9]+)/gi, "Invoice #$1");
  return t;
}

/**
 * Formats raw ISO date strings into clean, human readable date formats.
 * E.g., "2026-10-19" -> "Oct 19, 2026"
 */
export function formatHumanDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const isIsoOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    const d = new Date(isIsoOnly ? `${dateStr}T00:00:00` : dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Converts internal category identifiers into clean, human-friendly titles.
 */
export function humanizeEventType(type: string | null | undefined): string {
  switch (type?.toLowerCase()) {
    case "client_work":
      return "Client Work";
    case "meeting":
      return "Meeting";
    case "deadline":
      return "Deadline";
    case "personal":
      return "Personal";
    default:
      return type ? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Event";
  }
}
