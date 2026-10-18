"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { Trash2, RefreshCw, CloudUpload } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { compressBackground } from "@/lib/image-compressor";
import { uploadFileToCloudinary } from "@/lib/api";
import { logHandledError } from "@/lib/log-error";

interface BackgroundUploaderProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function BackgroundUploader({ value, onChange, disabled = false }: BackgroundUploaderProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image must be smaller than 20MB");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Compressing...");

    try {
      const compressed = await compressBackground(file);
      setStatusMessage("Saving to cloud...");

      const token = (await getToken()) || undefined;
      const uploaded = await uploadFileToCloudinary(
        compressed.blob,
        "linkpages",
        token,
        compressed.fileName
      );

      onChange(uploaded.url);
      toast.success(
        `Background uploaded (${Math.round(compressed.compressedSize / 1024)}KB)`
      );
    } catch (err) {
      logHandledError("Background upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload background");
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
    <div className="space-y-2">
      {/* Preview / drop target — full-bleed strip like the page will render it */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
        className={`relative group h-32 rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-all ${
          isDragging
            ? "border-accent ring-4 ring-accent/20"
            : "border-line hover:border-line-strong"
        } ${value ? "" : "bg-surface/40 flex items-center justify-center"}`}
        title="Click or drag an image to set your page background"
      >
        {value ? (
          <>
            <Image
              src={value}
              alt="Page background"
              width={640}
              height={256}
              unoptimized
              className="absolute inset-0 w-full h-full object-cover select-none"
              draggable={false}
            />
            <div className="absolute inset-0 bg-black/35 group-hover:bg-black/55 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <span className="text-white text-xs font-medium flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4" />
                Replace background
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted select-none">
            <ImagePlus className="w-5 h-5" />
            <span className="text-xs font-medium">Upload background photo</span>
            <span className="text-[10px] text-muted/70">Portrait or landscape, PNG / JPG / WebP</span>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1.5 text-white text-xs font-medium z-10">
            <RefreshCw className="w-4 h-4 animate-spin text-accent" />
            <span>{statusMessage || "Working..."}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
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
            title="Remove background photo"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1 text-danger" />
            <span>Remove</span>
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={onFileInputChange}
        disabled={disabled || isProcessing}
      />
    </div>
  );
}
