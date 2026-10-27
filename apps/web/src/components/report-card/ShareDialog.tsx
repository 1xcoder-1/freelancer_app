"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Globe,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Clock,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ShareStatusResponse,
  createShareLink,
  revokeShareLink,
} from "@/lib/api";

type Expiration = "never" | "1m" | "1h" | "24h" | "7d" | "30d";

const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never expires" },
  { value: "1m", label: "1 minute" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: ShareStatusResponse;
  username: string;
  onShareChanged: () => void;
}

function describeCountdown(expiresAt?: number | null): string {
  if (!expiresAt) return "Never expires";
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Link has expired";
  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `Expires in ${days}d ${hours}h`;
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Expires in ${minutes}m ${seconds}s`;
  return `Expires in ${seconds}s`;
}

/**
 * Two-screen share pop-up (unchanged behaviour from the previous report card,
 * now talking to the DB-backed /report-card/share endpoints).
 */
export function ShareDialog(props: ShareDialogProps) {
  const { open, onOpenChange, share } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-6 sm:p-7 rounded-2xl border-line/80 bg-card/95 backdrop-blur-xl shadow-2xl overflow-visible scrollbar-none">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-fg" />
            <DialogTitle className="text-base">Share Portfolio</DialogTitle>
          </div>
          <DialogDescription>
            Publish a public link to your portfolio.
          </DialogDescription>
        </DialogHeader>

        {/* Remounting when the server-side share state changes re-seeds the form
            from those values (React's key-based reset) instead of syncing state
            from an effect. */}
        <ShareDialogBody
          key={`${share.is_shared}:${share.include_styling}:${share.expiration}`}
          {...props}
        />
      </DialogContent>
    </Dialog>
  );
}

function ShareDialogBody({
  open,
  onOpenChange,
  share,
  username,
  onShareChanged,
}: ShareDialogProps) {
  const { getToken } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [includeStyling, setIncludeStyling] = useState(
    share.include_styling ?? true,
  );
  const [selectedExpiration, setSelectedExpiration] = useState<Expiration>(
    (share.expiration || "never") as Expiration,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tick, setTick] = useState(0);

  // Live countdown while the dialog is open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [open]);

  const originUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://freelance-book.app";
  const shareUrl = share.share_token
    ? `${originUrl}/u/${username}?token=${share.share_token}`
    : `${originUrl}/u/${username}`;

  const handleCreateShareLink = async () => {
    setIsSubmitting(true);
    try {
      const token = (await getToken()) || undefined;
      await createShareLink(
        { expiration: selectedExpiration, include_styling: includeStyling },
        token,
      );
      onShareChanged();
    } catch (err) {
      console.warn("Failed to create share link:", err);
      toast.error(err instanceof Error ? err.message : "Could not create share link. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveShareLink = async () => {
    setIsSubmitting(true);
    try {
      const token = (await getToken()) || undefined;
      await revokeShareLink(token);
      onShareChanged();
    } catch (err) {
      console.warn("Failed to revoke share link:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  void tick; // re-render for the countdown
  const countdownText = describeCountdown(share.expires_at);

  return (
    <>
      {share.is_shared ? (
        /* Screen 1 — link is live */
        <div className="space-y-4 pt-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-fg">
                Share Link
              </label>
              <span className="text-[10px] font-mono text-ok flex items-center gap-1">
                <Clock className="w-3 h-3" /> {countdownText}
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-2 bg-surface border border-line rounded-xl">
              <Link2 className="w-4 h-4 text-muted shrink-0 ml-1" />
              <span className="text-xs font-mono text-fg truncate flex-1 select-all">
                {shareUrl}
              </span>
              <Button
                onClick={copyToClipboard}
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                title="Copy share URL"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-ok" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                onClick={() => window.open(shareUrl, "_blank")}
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                title="Open live public link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-fg font-medium select-none pt-1">
            <input
              type="checkbox"
              checked={includeStyling}
              onChange={(e) => setIncludeStyling(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
            />
            <span>Include styling</span>
          </label>

          <div className="space-y-2 pt-2">
            <button
              onClick={handleRemoveShareLink}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-card border border-danger/30 text-danger font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Removing..." : "Remove link"}</span>
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-card border border-line text-fg font-semibold text-xs transition-all"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        /* Screen 2 — nothing shared yet */
        <div className="space-y-4 pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-fg font-medium select-none">
            <input
              type="checkbox"
              checked={includeStyling}
              onChange={(e) => setIncludeStyling(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
            />
            <span>Include styling</span>
          </label>

          <div>
            <label className="text-xs font-semibold text-fg block mb-1.5">
              Link Expiration
            </label>
            <CustomSelect
              value={selectedExpiration}
              onChange={(v) => setSelectedExpiration(v as Expiration)}
              options={EXPIRATION_OPTIONS}
              buttonClassName="w-full h-10 bg-surface/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="py-2.5 px-5 rounded-xl bg-surface hover:bg-card border border-line text-fg font-semibold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateShareLink}
              disabled={isSubmitting}
              className="py-2.5 px-5 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Creating..." : "Create link"}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
