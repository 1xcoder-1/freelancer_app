"use client";

import React, { useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Camera, Loader2 } from "@/components/animated-icons";
import { compressImage } from "@/lib/image-compressor";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";

/**
 * Identity header of the profile page: avatar, name and email. Name and
 * avatar come from Clerk — editing the photo here uploads straight through
 * the Clerk client so the sidebar (and everywhere else) updates in real
 * time, with no refresh.
 */
export function ProfileHeader({ username }: { username?: string }) {
  const { user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const name = user?.fullName || user?.firstName || "Freelancer";
  const email = user?.primaryEmailAddress?.emailAddress;

  const handleFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setBusy(true);
    try {
      const { blob } = await compressImage(file, 512, 0.85);
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp";
      const compressed = new File(
        [blob],
        file.name.replace(/\.\w+$/, "") + "." + ext,
        { type: blob.type || "image/webp" }
      );
      await user.setProfileImage({ file: compressed });
      toast.success("Profile photo updated");
    } catch (err) {
      logHandledError("Avatar upload failed:", err);
      toast.error("Could not update profile photo. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-5 min-w-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="relative w-20 h-20 sm:w-[86px] sm:h-[86px] rounded-[18px] overflow-hidden border border-neutral-700/50 bg-[#28292e] group shrink-0 disabled:opacity-60 shadow-sm flex items-center justify-center"
          title="Upload profile photo"
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={name}
              className="w-full h-full object-cover"
              suppressHydrationWarning
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center font-sans text-3xl font-medium text-neutral-200" suppressHydrationWarning>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        <div className="min-w-0 flex flex-col justify-center">
          <h1 className="font-sans text-2xl sm:text-[26px] font-normal tracking-normal text-white truncate" suppressHydrationWarning>
            {name}
          </h1>
          <p className="font-sans text-sm text-[#7d828c] mt-1 truncate font-normal tracking-normal" suppressHydrationWarning>
            {username ? (username.startsWith("@") ? username : `@${username}`) : user?.username ? `@${user.username}` : `@${name.toLowerCase().replace(/\s+/g, "")}`}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        <button
          type="button"
          className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800/40 transition-colors"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
