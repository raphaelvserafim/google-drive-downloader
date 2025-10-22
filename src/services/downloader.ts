import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { Readable } from 'stream';
import { IDownloadedFile, IDownloadOptions, IDownloadResult, IFileInfo, IFileMetadata, } from '../types';
import { detectMimeTypeFromExtension, extractFileId, getAvailableFormats } from '../validators';
import { CONFIG } from '../config';

export class GoogleDriveDownloader {
  private readonly userAgent = CONFIG.userAgent;

  private readonly googleDocMimeTypes = [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.form',
    'application/vnd.google-apps.drawing'
  ];

  /**
   * Gets file metadata without downloading
   */
  public async getFileMetadata(url: string): Promise<IFileMetadata> {
    const fileId = extractFileId(url);
    const fileInfo = await this.getFileInfo(fileId);
    const isGoogleDoc = this.googleDocMimeTypes.includes(fileInfo.mimeType || '');
    const availableFormats = isGoogleDoc ? getAvailableFormats(fileInfo.mimeType) : undefined;
    return {
      fileId,
      fileName: fileInfo.name,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      isGoogleDoc,
      availableFormats
    };
  }


  /**
   * Downloads a file from Google Drive
   */
  public async download(url: string, options: IDownloadOptions = {}): Promise<IDownloadResult> {
    try {
      const {
        timeout = CONFIG.DEFAULT_TIMEOUT,
        maxRetries = CONFIG.DEFAULT_MAX_RETRIES,
        exportFormat = 'original',
        asBuffer = true
      } = options;

      console.log('🔍 Processing URL:', url);

      const fileId = extractFileId(url);
      console.log('📄 Extracted File ID:', fileId);

      const fileInfo = await this.retryWithBackoff(
        () => this.getFileInfo(fileId),
        maxRetries
      );
      console.log('📝 File information:', fileInfo);

      const downloadUrls = this.getDownloadUrls(fileId, fileInfo.mimeType, exportFormat);
      console.log('⬇️ Starting download...');

      let response: AxiosResponse | null = null;
      let lastError: Error | null = null;

      // Try each download URL
      for (let i = 0; i < downloadUrls.length; i++) {
        try {
          console.log(`🔗 Attempt ${i + 1}/${downloadUrls.length}`);

          const axiosConfig: AxiosRequestConfig = {
            method: 'GET',
            url: downloadUrls[i],
            responseType: 'stream',
            timeout,
            headers: {
              'User-Agent': this.userAgent,
              'Accept': '*/*'
            },
            maxRedirects: 5
          };

          response = await axios(axiosConfig);
          const totalBytes = parseInt(response?.headers['content-length'] || '0', 10);
          console.log('📏 File size (from header):', totalBytes || 'unknown');
          // Check if response is HTML (indicating error or confirmation page)
          const contentType = response?.headers['content-type'] || '';
          if (contentType.includes('text/html')) {
            if (i === downloadUrls.length - 1) {
              console.log('⚠️ Trying large file download...');
              return await this.downloadLargeFile(fileId, fileInfo, asBuffer, timeout, exportFormat);
            } else {
              console.log('❌ HTML response received, trying next URL...');
              continue;
            }
          }

          console.log('✅ Download started successfully!');
          break;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.log(`❌ Attempt ${i + 1} failed:`, lastError.message);

          if (i === downloadUrls.length - 1) {
            throw lastError;
          }
        }
      }

      if (!response) {
        throw new Error('All download attempts failed');
      }

      return await this.processDownloadResponse(response, fileInfo, fileId, asBuffer, exportFormat);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Download error:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Downloads as buffer (for saving to file or upload)
   */
  public async downloadAsBuffer(url: string, options: Omit<IDownloadOptions, 'asBuffer'> = {}): Promise<IDownloadResult> {
    return this.download(url, { ...options, asBuffer: true });
  }

  /**
   * Downloads as stream (for data streaming)
   */
  public async downloadAsStream(url: string, options: Omit<IDownloadOptions, 'asBuffer'> = {}): Promise<IDownloadResult> {
    return this.download(url, { ...options, asBuffer: false });
  }

  /**
   * Utility to save file to local file system
   */
  public static async saveToFile(downloadResult: IDownloadResult, filePath: string): Promise<void> {
    if (!downloadResult.success || !downloadResult.file) {
      throw new Error(downloadResult.error || 'Download failed');
    }

    const fs = await import('fs');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (downloadResult.file.buffer) {
      // Save from buffer
      fs.writeFileSync(filePath, downloadResult.file.buffer);
    } else if (downloadResult.file.stream) {
      // Save from stream
      const writeStream = fs.createWriteStream(filePath);
      downloadResult.file.stream.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } else {
      throw new Error('File contains neither buffer nor stream');
    }
  }


  /**
   * Gets file information using Google Drive API
   */
  private async getFileInfo(fileId: string): Promise<IFileInfo> {
    try {
      const response: AxiosResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          params: {
            fields: 'name,mimeType,size'
          },
          timeout: 10000,
          headers: {
            'User-Agent': this.userAgent
          }
        }
      );

      return {
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size ? parseInt(response.data.size, 10) : undefined
      };
    } catch (error) {
      console.warn('Google Drive API failed, trying to extract information from page...');
      return await this.getFileInfoFromPage(fileId);
    }
  }

  /**
   * Extracts file information from HTML page when API fails
   */
  private async getFileInfoFromPage(fileId: string): Promise<IFileInfo> {
    try {
      const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
      const response = await axios.get(viewUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      let fileName = `file_${fileId}`;

      // Try to extract from page title
      const titleMatch = response.data.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        let title = titleMatch[1].trim();
        title = title.replace(/\s*-\s*Google Drive\s*$/i, '');
        if (title && title !== 'Google Drive') {
          fileName = title;
        }
      }

      // Try to extract from meta tags
      const ogTitleMatch = response.data.match(/property="og:title"\s+content="([^"]+)"/i);
      if (ogTitleMatch && ogTitleMatch[1] !== 'Google Drive') {
        fileName = ogTitleMatch[1].trim();
      }

      console.log('📝 Name extracted from page:', fileName);

      return {
        name: fileName,
        mimeType: detectMimeTypeFromExtension(fileName)
      };

    } catch (error) {
      console.warn('Could not extract information from page, using default name...');
      return {
        name: `file_${fileId}`,
        mimeType: null
      };
    }
  }

  /**
   * Generates download URLs based on file type and desired format
   */
  private getDownloadUrls(fileId: string, mimeType: string | null, exportFormat: string): string[] {
    const urls: string[] = [];

    // Specific URLs for Google Docs, Sheets and Slides
    if (mimeType?.includes('document')) {
      if (exportFormat === 'original' || exportFormat === 'docx') {
        urls.push(`https://docs.google.com/document/d/${fileId}/export?format=docx`);
      }
      if (exportFormat === 'pdf' || exportFormat === 'original') {
        urls.push(`https://docs.google.com/document/d/${fileId}/export?format=pdf`);
      }
    } else if (mimeType?.includes('spreadsheet')) {
      if (exportFormat === 'original' || exportFormat === 'xlsx') {
        urls.push(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`);
      }
      if (exportFormat === 'pdf' || exportFormat === 'original') {
        urls.push(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=pdf`);
      }
    } else if (mimeType?.includes('presentation')) {
      if (exportFormat === 'original' || exportFormat === 'pptx') {
        urls.push(`https://docs.google.com/presentation/d/${fileId}/export?format=pptx`);
      }
      if (exportFormat === 'pdf' || exportFormat === 'original') {
        urls.push(`https://docs.google.com/presentation/d/${fileId}/export?format=pdf`);
      }
    }

    // URLs ATUALIZADAS 2024 - PRIORIZAR drive.usercontent.google.com
    urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`);
    urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
    urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download`);


    // Default download URLs for normal files
    urls.push(`https://drive.google.com/uc?export=download&id=${fileId}`);
    urls.push(`https://drive.google.com/uc?id=${fileId}&export=download`);

    return urls;
  }

  /**
   * Converts stream to buffer more robustly
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        totalSize += chunk.length;

        // Protection against very large files
        if (totalSize > CONFIG.MAX_BUFFER_SIZE) {
          stream.destroy();
          reject(new Error(`File too large to process in memory (>${CONFIG.MAX_BUFFER_SIZE / 1024 / 1024}MB)`));
        }
      });

      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);

      // Timeout for pending streams
      setTimeout(() => {
        stream.destroy();
        reject(new Error('Timeout while converting stream to buffer'));
      }, 60000);
    });
  }



  /**
   * Detects MIME type based on buffer content
   */
  private detectMimeTypeFromBuffer(buffer: Buffer): string {
    if (buffer.length < 4) return 'application/octet-stream';

    // PDF
    if (buffer.slice(0, 4).toString() === '%PDF') {
      return 'application/pdf';
    }

    const firstBytes = Array.from(buffer.slice(0, 12));

    // JPEG
    if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF) {
      return 'image/jpeg';
    }

    // PNG
    if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47) {
      return 'image/png';
    }

    // GIF
    if (buffer.slice(0, 3).toString() === 'GIF') {
      return 'image/gif';
    }

    // WebP
    if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
      return 'image/webp';
    }

    // ZIP/Office formats
    if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B) {
      const zipBuffer = buffer.slice(0, 100).toString();
      if (zipBuffer.includes('word/')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (zipBuffer.includes('xl/')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (zipBuffer.includes('ppt/')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      return 'application/zip';
    }

    return 'application/octet-stream';
  }

  /**
   * Implements retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = CONFIG.DEFAULT_MAX_RETRIES,
    baseDelay: number = CONFIG.DEFAULT_RETRY_DELAY
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`🔄 Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Processes download response
   */
  private async processDownloadResponse(
    response: AxiosResponse,
    fileInfo: IFileInfo,
    fileId: string,
    asBuffer: boolean,
    exportFormat: string
  ): Promise<IDownloadResult> {
    let finalMimeType = fileInfo.mimeType;
    let finalFileName = fileInfo.name;

    // Adjust name and type based on export format
    if (exportFormat !== 'original' && this.googleDocMimeTypes.includes(fileInfo.mimeType || '')) {
      const nameWithoutExt = finalFileName.replace(/\.[^.]*$/, '');
      finalFileName = `${nameWithoutExt}.${exportFormat}`;
      finalMimeType = detectMimeTypeFromExtension(finalFileName);
    }

    if (asBuffer) {
      const buffer = await this.streamToBuffer(response.data);

      // Detect MIME type by content if necessary
      const detectedMimeType = this.detectMimeTypeFromBuffer(buffer);
      if (detectedMimeType !== 'application/octet-stream') {
        finalMimeType = detectedMimeType;
        console.log('📋 MIME type detected by content:', finalMimeType);
      }

      // Fallback to extension detection
      if (!finalMimeType || finalMimeType === 'application/octet-stream') {
        const extensionMimeType = detectMimeTypeFromExtension(finalFileName);
        if (extensionMimeType) {
          finalMimeType = extensionMimeType;
          console.log('📋 MIME type detected by extension:', finalMimeType);
        }
      }

      const downloadedFile: IDownloadedFile = {
        buffer: buffer,
        size: buffer.length,
        mimetype: finalMimeType || 'application/octet-stream',
        originalname: finalFileName
      };

      console.log('✅ Download completed!');
      console.log('📁 Name:', finalFileName);
      console.log('📋 Type:', finalMimeType);
      console.log('📏 Size:', buffer.length, 'bytes');

      return {
        success: true,
        file: downloadedFile,
        fileName: finalFileName,
        fileId: fileId,
        mimeType: finalMimeType || 'application/octet-stream',
        size: buffer.length
      };

    } else {
      const downloadedFile: IDownloadedFile = {
        stream: response.data,
        mimetype: finalMimeType || 'application/octet-stream',
        originalname: finalFileName
      };

      console.log('✅ Stream created successfully!');
      console.log('📁 Name:', finalFileName);
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      console.log('📏 File size (from header):', totalBytes || 'unknown');

      return {
        success: true,
        file: downloadedFile,
        fileName: finalFileName,
        fileId: fileId,
        mimeType: finalMimeType || 'application/octet-stream',
        totalBytes: totalBytes || 0
      };
    }
  }

  /**
   * Handles download of large files that require confirmation
   */
  private async downloadLargeFile(
    fileId: string,
    fileInfo: IFileInfo,
    asBuffer: boolean,
    timeout: number = CONFIG.LARGE_FILE_TIMEOUT,
    exportFormat: string = 'original'
  ): Promise<IDownloadResult> {
    try {
      console.log('🔄 Processing large file...');

      const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const confirmResponse = await axios.get(confirmUrl, {
        timeout: timeout / 2,
        headers: {
          'User-Agent': this.userAgent
        }
      });

      const confirmMatch = confirmResponse.data.match(/confirm=([^&"']+)/);
      if (!confirmMatch) {
        throw new Error('Confirmation token not found for large file');
      }

      const confirmToken = confirmMatch[1];
      const downloadUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}`;

      console.log('🔑 Confirmation token obtained, starting download...');

      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: timeout,
        headers: {
          'User-Agent': this.userAgent
        }
      });


      return await this.processDownloadResponse(response, fileInfo, fileId, asBuffer, exportFormat);

    } catch (error) {
      throw new Error(`Large file download error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}

