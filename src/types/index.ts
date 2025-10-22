import { Readable } from 'stream';

export interface IFileInfo {
  name: string;
  mimeType: string | null;
  size?: number;
}

export interface IDownloadedFile {
  buffer?: Buffer;
  stream?: Readable;
  mimetype: string;
  originalname: string;
  size?: number;
}

export interface IDownloadResult {
  success: boolean;
  file?: IDownloadedFile;
  fileName?: string;
  fileId?: string;
  mimeType?: string;
  size?: number;
  error?: string;
  totalBytes?: number;
}

export interface IDownloadOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  exportFormat?: 'original' | 'pdf' | 'docx' | 'xlsx' | 'pptx';
  asBuffer?: boolean;
}

export interface IFileMetadata {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  size?: number;
  isGoogleDoc: boolean;
  availableFormats?: string[];
}



export const mimeTypeMap: Record<string, string> = {
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'csv': 'text/csv',
  'rtf': 'application/rtf',
  'odt': 'application/vnd.oasis.opendocument.text',
  'ods': 'application/vnd.oasis.opendocument.spreadsheet',
  'odp': 'application/vnd.oasis.opendocument.presentation',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'bmp': 'image/bmp',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'zip': 'application/zip',
  'rar': 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  'json': 'application/json',
  'xml': 'application/xml',
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript'
};