/**
 * Netlify Functions buffer binary bodies with base64 overhead (~30%), so the
 * effective max binary payload is ~4.5MB (see Netlify troubleshooting). Sending
 * larger bodies returns a platform 500 ("Internal Error") before our handler runs.
 * We keep a margin under that limit for OCR screenshots.
 */
const MAX_BINARY_BYTES = 4_000_000;

const loadImageBitmap = async (file: File): Promise<ImageBitmap> => {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0);
    return createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const blobToJpegFile = (blob: Blob, baseName: string): File => {
  const withoutExt = baseName.replace(/\.[^/.]+$/, '');
  return new File([blob], `${withoutExt}.jpg`, { type: 'image/jpeg' });
};

/**
 * If the file is over Netlify's effective binary limit, downscale and re-encode as JPEG
 * until it fits (or we hit a minimum dimension).
 */
export async function ensureImageUnderNetlifyBodyLimit(file: File): Promise<{ file: File; wasResized: boolean }> {
  if (file.size <= MAX_BINARY_BYTES) {
    return { file, wasResized: false };
  }

  const bitmap = await loadImageBitmap(file);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    let quality = 0.88;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    const minSide = 640;
    for (let attempt = 0; attempt < 28; attempt++) {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_BINARY_BYTES) {
        return { file: blobToJpegFile(blob, file.name), wasResized: true };
      }

      if (quality > 0.62) {
        quality -= 0.04;
        continue;
      }

      const nextW = Math.max(minSide, Math.floor(width * 0.88));
      const nextH = Math.max(minSide, Math.floor(height * 0.88));
      if (nextW === width && nextH === height) {
        break;
      }
      width = nextW;
      height = nextH;
      quality = 0.88;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(bitmap, 0, 0, width, height);
    let lastBlob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.55));
    if (!lastBlob) {
      throw new Error('Failed to compress image for Netlify proxy');
    }
    if (lastBlob.size <= MAX_BINARY_BYTES) {
      return { file: blobToJpegFile(lastBlob, file.name), wasResized: true };
    }

    let w = width;
    let h = height;
    while (w > 320 && h > 320) {
      w = Math.max(320, Math.floor(w * 0.82));
      h = Math.max(320, Math.floor(h * 0.82));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(bitmap, 0, 0, w, h);
      lastBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.48));
      if (lastBlob && lastBlob.size <= MAX_BINARY_BYTES) {
        return { file: blobToJpegFile(lastBlob, file.name), wasResized: true };
      }
    }

    throw new Error('Screenshot is still too large after compression; try a smaller crop or lower resolution.');
  } finally {
    bitmap.close?.();
  }
}
