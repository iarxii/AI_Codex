export interface ChatAttachment {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const DOC_EXTENSIONS = new Set(["md", "txt", "pdf"]);

const MAX_ATTACHMENTS = 6;
const MAX_DOC_TEXT_CHARS = 12000;

const getExtension = (filename: string): string => {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const isSupportedAttachment = (file: File): boolean => {
  const extension = getExtension(file.name);
  if (IMAGE_EXTENSIONS.has(extension)) return true;
  if (DOC_EXTENSIONS.has(extension)) return true;

  if (file.type.startsWith("image/")) return true;
  if (file.type === "text/markdown" || file.type === "text/plain" || file.type === "application/pdf") return true;

  return false;
};

export const formatAttachmentSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const toChatAttachment = (file: File): ChatAttachment => ({
  id: `${file.name}-${file.lastModified}-${file.size}`,
  file,
  name: file.name,
  type: file.type || "application/octet-stream",
  size: file.size,
  lastModified: file.lastModified,
});

export const normalizeAttachments = (files: FileList | null): {
  accepted: ChatAttachment[];
  rejected: string[];
  capped: boolean;
} => {
  if (!files || files.length === 0) {
    return { accepted: [], rejected: [], capped: false };
  }

  const accepted: ChatAttachment[] = [];
  const rejected: string[] = [];

  Array.from(files).forEach((file) => {
    if (isSupportedAttachment(file)) {
      accepted.push(toChatAttachment(file));
    } else {
      rejected.push(file.name);
    }
  });

  const capped = accepted.length > MAX_ATTACHMENTS;
  return {
    accepted: accepted.slice(0, MAX_ATTACHMENTS),
    rejected,
    capped,
  };
};

export const buildAttachmentPromptContext = async (attachments: ChatAttachment[]): Promise<string> => {
  if (!attachments.length) return "";

  const chunks: string[] = ["", "[ATTACHMENTS_CONTEXT]"];

  for (const attachment of attachments) {
    const extension = getExtension(attachment.name);
    const header = `- File: ${attachment.name} (${attachment.type || "unknown"}, ${formatAttachmentSize(attachment.size)})`;

    if (IMAGE_EXTENSIONS.has(extension) || attachment.type.startsWith("image/")) {
      chunks.push(header);
      chunks.push("  Content: Image attachment provided by user. Use the filename and user prompt context to reason about this media.");
      continue;
    }

    if (extension === "pdf" || attachment.type === "application/pdf") {
      chunks.push(header);
      chunks.push("  Content: PDF attachment provided. Text extraction is deferred; reason using filename and user prompt context.");
      continue;
    }

    try {
      const text = await attachment.file.text();
      const clipped = text.length > MAX_DOC_TEXT_CHARS
        ? `${text.slice(0, MAX_DOC_TEXT_CHARS)}\n...[TRUNCATED]`
        : text;

      chunks.push(header);
      chunks.push("  Extracted text:");
      chunks.push("```text");
      chunks.push(clipped);
      chunks.push("```");
    } catch {
      chunks.push(header);
      chunks.push("  Content: Unable to read this document in browser context.");
    }
  }

  chunks.push("[/ATTACHMENTS_CONTEXT]");
  return chunks.join("\n");
};
