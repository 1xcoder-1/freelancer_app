/**
 * Professional client-side image compressor.
 * Downscales images to max dimensions, strips EXIF overhead,
 * and exports crisp, modern WebP/JPEG blobs at optimal quality
 * before uploading to Cloudinary.
 */
export interface CompressionResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  maxDimension = 512,
  quality = 0.85
): Promise<CompressionResult> {
  // If not an image, pass through
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image."));
      img.onload = () => {
        let { width, height } = img;

        // Calculate proportional scale capped at maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) {
          reject(new Error("Canvas context is unavailable."));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer modern WebP format; falls back cleanly
        const mimeType = "image/webp";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Image compression failed."));
              return;
            }

            const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const cleanName = `${baseName.replace(/[^a-zA-Z0-9_\-]/g, "_")}.webp`;

            resolve({
              blob,
              fileName: cleanName,
              originalSize: file.size,
              compressedSize: blob.size,
              width,
              height,
            });
          },
          mimeType,
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compress a page-background photo: WebP, capped at 1600px, quality 0.8,
 * degrading quality until the blob fits under 400KB (full-bleed images
 * otherwise dwarf the rest of the page payload).
 */
export async function compressBackground(file: File): Promise<CompressionResult> {
  const MAX_BYTES = 400 * 1024;
  let result = await compressImage(file, 1600, 0.8);
  for (const q of [0.65, 0.5, 0.38]) {
    if (result.compressedSize <= MAX_BYTES) return result;
    result = await compressImage(file, 1600, q);
  }
  return result;
}
