"use client";

import React, { useCallback, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Search } from "lucide-react";
import { getStockImages, type StockImage } from "@/lib/api";
import { logHandledError } from "@/lib/log-error";

/* Browse-and-pick grid for Unsplash backgrounds. The API key lives on the
   server; a 501 from /stock/images means the server has no key configured,
   which we surface as a calm note instead of an error. */

const DEFAULT_QUERY = "abstract gradient";

export function StockPhotoPicker({
  onSelect,
  disabled = false,
}: {
  onSelect: (url: string) => void;
  disabled?: boolean;
}) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const search = useCallback(async (term: string) => {
    setLoading(true);
    setNotice("");
    try {
      const token = (await getToken()) || undefined;
      const data = await getStockImages(term, token);
      setResults(data.images);
      if (data.images.length === 0) setNotice("No photos found for that search.");
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 501) {
        setNotice("Stock photos aren't set up on this server yet — upload your own photo instead.");
      } else if (status === 429) {
        setNotice("Too many searches right now — try again in a minute.");
      } else {
        setNotice("Couldn't load stock photos. Please try again.");
        logHandledError("Stock photo search failed:", e);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          if (results.length === 0) void search(DEFAULT_QUERY);
        }}
        className="text-xs font-medium text-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
      >
        or browse stock photos
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-line bg-surface/30 p-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center flex-1 h-8.5 px-3 rounded-lg border border-line bg-card focus-within:border-line-strong transition-all">
          <Search className="w-3.5 h-3.5 text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) void search(query.trim());
            }}
            placeholder="Search photos — e.g. mountain, studio, pastel"
            className="w-full h-full px-2 bg-transparent text-fg text-xs placeholder:text-muted/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          disabled={disabled || loading || !query.trim()}
          onClick={() => void search(query.trim())}
          className="h-8.5 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shrink-0"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-8.5 px-2 text-muted hover:text-fg text-xs cursor-pointer shrink-0"
          title="Close stock photos"
        >
          Close
        </button>
      </div>

      {notice && <p className="text-[11px] text-muted leading-relaxed">{notice}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-0.5">
          {results.map((img) => (
            <button
              key={img.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(img.url)}
              className="group relative h-20 rounded-lg overflow-hidden border border-line hover:border-line-strong hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50"
              title={img.description || "Stock photo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumb}
                alt={img.description || "Stock photo"}
                className="absolute inset-0 w-full h-full object-cover select-none"
                draggable={false}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-[10px] text-muted/70">
        Photos from Unsplash — credit shown to each photographer on their page.
      </p>
    </div>
  );
}
