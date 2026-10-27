/**
 * Multimodal input processing and validation for SuperAgent.
 * Enforces typed structured message parts:
 * - TextPart: { type: 'text', text: string }
 * - ImagePart: { type: 'image', image: string, mimeType: string } (pure base64)
 * - Enforces MIME and payload limits (max 10 MiB per image, max 5 images).
 * - Strips base64 from prompt history and logging to preserve storage and console hygiene.
 * - Validates model vision capability with explicit fallback.
 */

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  image: string; // pure base64 without data: URL prefix
  mimeType: string;
  name?: string;
}

export type MultimodalPart = TextPart | ImagePart;
export type CoreMessagePayload = string | MultimodalPart[];

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB per image
export const MAX_IMAGE_COUNT = 5;

// Text-only models that lack multimodal vision processing capabilities
const KNOWN_TEXT_ONLY_MODEL_PATTERNS = [
  /^gpt-3\.5/i,
  /^text-davinci/i,
  /^claude-2/i,
  /^claude-1/i,
  /^deepseek-coder/i,
  /^llama-2/i,
  /^qwen-1\.5-chat/i,
];

export function isModelMultimodalCapable(modelName?: string): boolean {
  if (!modelName || typeof modelName !== 'string') return true; // Default permissive if unknown
  const trimmed = modelName.trim().toLowerCase();
  for (const pattern of KNOWN_TEXT_ONLY_MODEL_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  return true;
}

export interface MultimodalValidationResult {
  valid: boolean;
  error?: string;
  sanitizedParts?: MultimodalPart[];
  cleanHistoryText?: string;
}

/**
 * Normalizes and validates incoming multimodal parts.
 * Strips 'data:image/...;base64,' prefix if present so Core receives pure base64.
 */
export function validateAndSanitizeMultimodalInput(
  rawText: string,
  rawParts?: unknown[],
  activeModelName?: string
): MultimodalValidationResult {
  const text = typeof rawText === 'string' ? rawText.trim() : '';

  if (!rawParts || !Array.isArray(rawParts) || rawParts.length === 0) {
    if (!text) {
      return { valid: false, error: 'Empty message. Please enter text or attach an image.' };
    }
    return {
      valid: true,
      sanitizedParts: [{ type: 'text', text }],
      cleanHistoryText: text,
    };
  }

  // Model capability check
  if (activeModelName && !isModelMultimodalCapable(activeModelName)) {
    return {
      valid: false,
      error: `Model "${activeModelName}" does not support image attachments. Please select a vision-capable model (such as Claude 3.5 Sonnet, GPT-4o, or Gemini 1.5/2.0).`,
    };
  }

  const sanitizedParts: MultimodalPart[] = [];
  const historyLabels: string[] = [];
  let imageCount = 0;

  if (text) {
    sanitizedParts.push({ type: 'text', text });
    historyLabels.push(text);
  }

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i] as any;
    if (!part || typeof part !== 'object') continue;

    if (part.type === 'text') {
      const partText = typeof part.text === 'string' ? part.text.trim() : '';
      if (partText && partText !== text) {
        sanitizedParts.push({ type: 'text', text: partText });
        historyLabels.push(partText);
      }
      continue;
    }

    if (part.type === 'image') {
      imageCount++;
      if (imageCount > MAX_IMAGE_COUNT) {
        return {
          valid: false,
          error: `Too many images attached. Maximum allowed is ${MAX_IMAGE_COUNT} images per prompt.`,
        };
      }

      let mimeType = typeof part.mimeType === 'string' ? part.mimeType.toLowerCase().trim() : '';
      let rawImage = typeof part.image === 'string' ? part.image.trim() : '';

      // Handle Data URL format if supplied by client: data:image/png;base64,....
      if (rawImage.startsWith('data:')) {
        const matches = rawImage.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          if (!mimeType) mimeType = matches[1].toLowerCase().trim();
          rawImage = matches[2];
        }
      }

      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
        return {
          valid: false,
          error: `Unsupported image format "${mimeType || 'unknown'}". Supported formats: PNG, JPEG, WEBP, GIF.`,
        };
      }

      // Estimate byte length from base64 string
      const padding = rawImage.endsWith('==') ? 2 : rawImage.endsWith('=') ? 1 : 0;
      const estimatedBytes = (rawImage.length * 3) / 4 - padding;

      if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
        const sizeMb = (estimatedBytes / (1024 * 1024)).toFixed(1);
        return {
          valid: false,
          error: `Image attachment is too large (${sizeMb} MiB). Maximum allowed size is 10 MiB per image.`,
        };
      }

      if (estimatedBytes < 16) {
        return {
          valid: false,
          error: 'Image attachment data is empty or invalid.',
        };
      }

      sanitizedParts.push({
        type: 'image',
        image: rawImage,
        mimeType,
        ...(part.name ? { name: String(part.name) } : {}),
      });

      const label = part.name ? `[image: ${part.name}]` : `[image: ${mimeType}]`;
      historyLabels.push(label);
    }
  }

  if (sanitizedParts.length === 0) {
    return { valid: false, error: 'Empty message. Please enter text or attach an image.' };
  }

  return {
    valid: true,
    sanitizedParts,
    cleanHistoryText: historyLabels.join(' ').trim(),
  };
}
