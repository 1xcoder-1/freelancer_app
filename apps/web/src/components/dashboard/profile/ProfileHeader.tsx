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
    <div className="flex items-center gap-5 sm:gap-6">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-line bg-surface group shrink-0 disabled:opacity-60"
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
          <span className="w-full h-full flex items-center justify-center font-display text-2xl font-bold text-fg" suppressHydrationWarning>
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

      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg truncate" suppressHydrationWarning>
          {name}
        </h1>
        <p className="text-sm text-muted mt-0.5 truncate" suppressHydrationWarning>
          {username ? `@${username}` : email || " "}
        </p>
        {username && email && (
          <p className="text-xs text-muted/70 mt-0.5 truncate hidden sm:block">{email}</p>
        )}
      </div>
    </div>
  );
}
