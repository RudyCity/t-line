/**
 * Client-side multimodal preparation and validation for SuperAgent console.
 *
 * Enforces:
 * 1. Images are passed as structured typed content parts, never appended as Data URLs in prompt text.
 * 2. Validates MIME type and file size before submission.
 * 3. Never stores raw base64 as visible chat text or in prompt history.
 */

export interface AttachmentItem {
  id?: string;
  type: 'image' | 'document';
  file: File;
  previewUrl?: string;
}

export interface MultimodalContentPart {
  type: 'text' | 'image';
  text?: string;
  image?: string; // pure base64
  mimeType?: string;
  name?: string;
}

export interface PreparedPromptSubmission {
  promptText: string;
  parts: MultimodalContentPart[];
  cleanDisplayText: string;
}

export const CLIENT_SUPPORTED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export const CLIENT_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export function readFileAsBase64Raw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip 'data:image/...;base64,' prefix
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function prepareMultimodalPrompt(
  prompt: string,
  attachments: AttachmentItem[],
  readDocumentText: (file: File) => Promise<string>
): Promise<
  | { success: true; submission: PreparedPromptSubmission }
  | { success: false; error: string }
> {
  const trimmed = prompt.trim();
  const imageAttachments = attachments.filter((a) => a.type === 'image');
  const docAttachments = attachments.filter((a) => a.type === 'document');

  // Validate image count
  if (imageAttachments.length > 5) {
    return { success: false, error: 'Maximum 5 images allowed per message.' };
  }

  // Validate MIME types and sizes
  for (const img of imageAttachments) {
    const mime = (img.file.type || '').toLowerCase();
    if (!CLIENT_SUPPORTED_IMAGE_MIMES.has(mime)) {
      return {
        success: false,
        error: `Unsupported image format "${img.file.name}" (${mime || 'unknown'}). Supported formats: PNG, JPEG, WEBP, GIF.`,
      };
    }
    if (img.file.size > CLIENT_MAX_IMAGE_SIZE_BYTES) {
      const mb = (img.file.size / (1024 * 1024)).toFixed(1);
      return {
        success: false,
        error: `Image "${img.file.name}" is too large (${mb} MiB). Maximum allowed size is 10 MiB.`,
      };
    }
  }

  // Build document text if any
  let finalPromptText = trimmed;
  if (docAttachments.length > 0) {
    const docParts: string[] = [];
    for (const doc of docAttachments) {
      try {
        const content = await readDocumentText(doc.file);
        docParts.push(`\n--- ATTACHED FILE: ${doc.file.name} ---\n${content}\n---------------------------------\n`);
      } catch (err: any) {
        return { success: false, error: `Failed to read file ${doc.file.name}: ${err?.message || err}` };
      }
    }
    finalPromptText += '\n\n[Attached Files]:' + docParts.join('');
  }

  // Build structured multimodal parts
  const parts: MultimodalContentPart[] = [];
  if (finalPromptText) {
    parts.push({ type: 'text', text: finalPromptText });
  }

  for (const img of imageAttachments) {
    try {
      const base64Data = await readFileAsBase64Raw(img.file);
      parts.push({
        type: 'image',
        image: base64Data,
        mimeType: img.file.type || 'image/png',
        name: img.file.name,
      });
    } catch (err: any) {
      return { success: false, error: `Failed to process image ${img.file.name}: ${err?.message || err}` };
    }
  }

  if (parts.length === 0) {
    return { success: false, error: 'Cannot send empty prompt without content or attachments.' };
  }

  // Clean display text for chat UI: NO raw base64 data URLs!
  let cleanDisplayText = trimmed;
  if (imageAttachments.length > 0) {
    const labels = imageAttachments.map((img) => `📎 ${img.file.name}`).join(' ');
    cleanDisplayText = cleanDisplayText ? `${cleanDisplayText}\n[${labels}]` : `[${labels}]`;
  }
  if (docAttachments.length > 0) {
    const labels = docAttachments.map((doc) => `📄 ${doc.file.name}`).join(' ');
    cleanDisplayText = cleanDisplayText ? `${cleanDisplayText}\n[${labels}]` : `[${labels}]`;
  }

  return {
    success: true,
    submission: {
      promptText: finalPromptText,
      parts,
      cleanDisplayText,
    },
  };
}
