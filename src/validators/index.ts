import { CONFIG } from "../config";
import { mimeTypeMap } from "../types";

export const fileIdPatterns: RegExp[] = [
  /\/file\/d\/([a-zA-Z0-9-_]+)/,
  /id=([a-zA-Z0-9-_]+)/,
  /\/d\/([a-zA-Z0-9-_]+)\/view/,
  /\/d\/([a-zA-Z0-9-_]+)\/edit/,
  /\/document\/d\/([a-zA-Z0-9-_]+)/,
  /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  /\/presentation\/d\/([a-zA-Z0-9-_]+)/,
  /\/forms\/d\/([a-zA-Z0-9-_]+)/,
  /\/drawings\/d\/([a-zA-Z0-9-_]+)/
];


export const getAvailableFormats = (mimeType: string | null): string[] => {
  if (!mimeType) return [];
  if (mimeType.includes('document')) {
    return ['pdf', 'docx', 'odt', 'rtf', 'txt', 'html', 'epub'];
  } else if (mimeType.includes('spreadsheet')) {
    return ['pdf', 'xlsx', 'ods', 'csv', 'tsv', 'html', 'zip'];
  } else if (mimeType.includes('presentation')) {
    return ['pdf', 'pptx', 'odp', 'txt', 'jpeg', 'png', 'svg'];
  } else if (mimeType.includes('drawing')) {
    return ['pdf', 'svg', 'png', 'jpeg'];
  }

  return ['pdf'];
}


export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[<>:"/\\|?*\x00-\x1f\x80-\x9f]/g, '')
    .replace(/[._-]{2,}/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .substring(0, CONFIG.MAX_FILENAME_LENGTH)
    || 'arquivo_sem_nome';
}


export const detectMimeTypeFromExtension = (fileName: string): string | null => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? mimeTypeMap[extension] || null : null;
}

export const extractFileId = (url: string): string => {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }
  const cleanUrl = url.trim();
  for (const pattern of fileIdPatterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('File ID not found in URL. Please verify it is a valid Google Drive URL');
}