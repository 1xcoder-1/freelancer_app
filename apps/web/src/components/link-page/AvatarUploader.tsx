"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Camera, Trash2, RefreshCw, CloudUpload } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compressor";
import { uploadFileToCloudinary } from "@/lib/api";

interface AvatarUploaderProps {
  value: string;
  onChange: (url: string) => void;
  displayName?: string;
  disabled?: boolean;
}

export function AvatarUploader({
  value,
  onChange,
  displayName = "Avatar",
  disabled = false,
}: AvatarUploaderProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "LP";

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }

    // Limit raw upload to 15MB before compression
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image must be smaller than 15MB");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Compressing...");

    try {
      // 1. Professional client-side compression
      const compressed = await compressImage(file, 512, 0.85);

      setStatusMessage("Saving to cloud...");

      // 2. Real-time storage on Cloudinary
      const token = (await getToken()) || undefined;
      const uploaded = await uploadFileToCloudinary(
        compressed.blob,
        "avatars",
        token,
        compressed.fileName
      );

      onChange(uploaded.url);
      const savedKb = Math.round((compressed.originalSize - compressed.compressedSize) / 1024);
      toast.success(
        savedKb > 0
          ? `Avatar uploaded (${Math.round(compressed.compressedSize / 1024)}KB, saved ${savedKb}KB)`
          : "Avatar uploaded to cloud"
      );
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileProcess(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isProcessing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileProcess(file);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-1">
      {/* Avatar Circle Container / Drop Target */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
        className={`relative group w-20 h-20 rounded-full border-2 overflow-hidden shrink-0 cursor-pointer transition-all ${
          isDragging
            ? "border-accent ring-4 ring-accent/20 scale-105"
            : "border-line hover:border-line-strong hover:scale-[1.02]"
        } bg-surface/70 flex items-center justify-center`}
        title="Click or drag image to upload avatar"
      >
        {value ? (
          <Image
            src={value}
            alt={displayName}
            width={80}
            height={80}
            unoptimized
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted font-display font-semibold text-lg select-none">
            <span>{initials}</span>
          </div>
        )}

        {/* Hover overlay with camera icon */}
        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[10px] font-medium backdrop-blur-[1px]">
          <Camera className="w-4 h-4" />
          <span>Upload</span>
        </div>

        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1 text-white text-[9px] font-medium z-10">
            <RefreshCw className="w-4 h-4 animate-spin text-accent" />
            <span className="text-center px-1 leading-tight">{statusMessage || "Working..."}</span>
          </div>
        )}
      </div>

      {/* Action Buttons & Details */}
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 text-xs rounded-lg border-line hover:border-line-strong hover:bg-surface cursor-pointer font-medium"
          >
            <CloudUpload className="w-3.5 h-3.5 mr-1.5 text-accent" />
            <span>{value ? "Change photo" : "Upload photo"}</span>
          </Button>

          {value && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || isProcessing}
              onClick={() => onChange("")}
              className="h-8 text-xs rounded-lg border-line hover:border-danger/40 text-muted hover:text-danger hover:bg-danger/10 cursor-pointer"
              title="Remove avatar photo"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1 text-danger" />
              <span>Remove</span>
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted leading-relaxed">
          Compressed client-side and saved to Cloudinary. PNG, JPG, or WebP.
        </p>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/jpg"
          className="hidden"
          onChange={onFileInputChange}
          disabled={disabled || isProcessing}
        />
      </div>
    </div>
  );
}
