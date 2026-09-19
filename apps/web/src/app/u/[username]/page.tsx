"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPublicPortfolio, PortfolioProfile as IPortfolioProfile } from "@/lib/api";
import { ReportCard } from "@/app/dashboard/report-card/ReportCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PublicProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawUsername = params?.username as string;
  const username = rawUsername ? decodeURIComponent(rawUsername) : "1xcoder";
  const shareToken = searchParams?.get("token");

  const [profile, setProfile] = useState<IPortfolioProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"valid" | "revoked" | "expired">("valid");

  // Secure Server-Side Profile & Share Status Fetching
  const loadData = useCallback(async (isBackgroundCheck = false) => {
    try {
      if (!isBackgroundCheck) {
        setLoading(true);
        setError(null);
      }
      const data = await getPublicPortfolio(username, shareToken);
      setProfile(data);
      setShareStatus("valid");
    } catch (err: any) {
      const statusCode = err?.response?.status;
      if (statusCode === 410) {
        setShareStatus("expired");
      } else if (statusCode === 403) {
        setShareStatus("revoked");
      } else {
        if (!isBackgroundCheck) {
          setError(err?.response?.data?.detail || "The requested freelancer developer profile does not exist or is unavailable.");
        }
      }
    } finally {
      if (!isBackgroundCheck) {
        setLoading(false);
      }
    }
  }, [username, shareToken]);

  useEffect(() => {
    loadData(false);

    // Secure server-side status poll every 4 seconds to detect real-time revocation/expiration without any local storage
    const interval = setInterval(() => {
      loadData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121820] text-white p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-lg bg-slate-800" />
              <Skeleton className="w-32 h-6 rounded bg-slate-800" />
            </div>
            <Skeleton className="w-24 h-8 rounded bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <Skeleton className="w-full h-80 rounded-2xl bg-slate-800" />
              <Skeleton className="w-full h-40 rounded-2xl bg-slate-800" />
            </div>
            <div className="lg:col-span-8 space-y-6">
              <Skeleton className="w-full h-36 rounded-2xl bg-slate-800" />
              <Skeleton className="w-full h-64 rounded-2xl bg-slate-800" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle Revoked Share Link State
  if (shareStatus === "revoked") {
    return (
      <div className="min-h-screen bg-[#121820] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Share Link Revoked</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          The public share link for this report card has been removed or set to private by the author.
        </p>
        <Link href="/dashboard/report-card">
          <Button className="bg-[#21262d] hover:bg-[#30363d] text-white font-medium text-xs rounded-xl border border-white/10 px-5">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Handle Expired Share Link State
  if (shareStatus === "expired") {
    return (
      <div className="min-h-screen bg-[#121820] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Share Link Expired</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          This temporary share link has exceeded its configured expiration period.
        </p>
        <Link href="/dashboard/report-card">
          <Button className="bg-[#21262d] hover:bg-[#30363d] text-white font-medium text-xs rounded-xl border border-white/10 px-5">
            Generate New Share Link
          </Button>
        </Link>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#121820] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          {error || "The requested freelancer developer profile does not exist."}
        </p>
        <Link href="/">
          <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl">
            Return to Freelancer OS
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <ReportCard
      profile={profile}
    />
  );
}
