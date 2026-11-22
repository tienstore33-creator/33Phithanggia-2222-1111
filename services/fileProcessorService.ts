export interface ProcessedFile {
  name: string;
  mimeType: string;
  base64Data: string;
  previewUrl: string;
  size: number;
  textContent?: string;
}

/**
 * Compress image if it exceeds max dimensions to save memory & bandwidth
 */
export async function compressImageIfNeeded(file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // Fallback to raw base64 if canvas context fails
        resolve((reader.result as string).split(',')[1]);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const mime = file.type || 'image/jpeg';
      const dataUrl = canvas.toDataURL(mime, quality);
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };

    img.onerror = (err) => reject(err);
    reader.onerror = (err) => reject(err);

    reader.readAsDataURL(file);
  });
}

/**
 * Reads any File object (image, txt, json, pdf, etc.) and returns ProcessedFile with base64 data
 */
export async function processFile(file: File): Promise<ProcessedFile> {
  const mimeType = file.type || 'application/octet-stream';
  const isImage = mimeType.startsWith('image/');

  let base64Data = '';
  let previewUrl = '';

  if (isImage) {
    base64Data = await compressImageIfNeeded(file);
    previewUrl = `data:${mimeType};base64,${base64Data}`;
    return {
      name: file.name,
      mimeType,
      base64Data,
      previewUrl,
      size: file.size,
    };
  } else {
    base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Strip data:mime/type;base64, header
        const commaIndex = result.indexOf(',');
        resolve(commaIndex !== -1 ? result.substring(commaIndex + 1) : result);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    const isTextFile = mimeType.startsWith('text/') || 
                       mimeType === 'application/json' || 
                       /\.(txt|json|md|py|js|ts|csv|html|css|xml)$/i.test(file.name);

    let textContent: string | undefined = undefined;
    if (isTextFile) {
      textContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
      });
    }

    if (isTextFile) {
      previewUrl = `data:${mimeType};base64,${base64Data}`;
    } else {
      previewUrl = '';
    }

    return {
      name: file.name,
      mimeType,
      base64Data,
      previewUrl,
      size: file.size,
      textContent,
    };
  }
}
