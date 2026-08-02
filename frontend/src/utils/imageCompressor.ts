/**
 * imageCompressor.ts — Canvas-based image compression & downscaling for t-line desktop client.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<{ base64: string; compressedSize: number; originalSize: number }> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.85 } = options;
  const originalSize = file.size;

  // Non-image or small SVG, return original data URL directly
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    const base64 = await readFileAsDataURL(file);
    return { base64, compressedSize: originalSize, originalSize };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const fallback = event.target?.result as string;
          resolve({ base64: fallback, compressedSize: originalSize, originalSize });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const base64 = canvas.toDataURL(mimeType, quality);
        const compressedSize = Math.round((base64.length * 3) / 4);

        resolve({ base64, compressedSize, originalSize });
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
