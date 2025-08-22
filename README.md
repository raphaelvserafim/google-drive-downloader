# Google Drive Downloader

A powerful and flexible Node.js library for downloading files from Google Drive, supporting both regular files and Google Docs/Sheets/Slides with multiple export formats.

## Features

- ✅ Download any public Google Drive file
- ✅ Support for Google Docs, Sheets, and Slides with multiple export formats
- ✅ Automatic MIME type detection
- ✅ Buffer and stream download options
- ✅ Retry mechanism with exponential backoff
- ✅ Large file support with confirmation handling
- ✅ TypeScript support
- ✅ No API key required for public files

## Installation

```bash
npm install @raphaelvserafim/google-drive-downloader
```

## Quick Start

```javascript
const { GoogleDriveDownloader } = require('@raphaelvserafim/google-drive-downloader');

const downloader = new GoogleDriveDownloader();

// Download a file as buffer
async function downloadFile() {
  const url = 'https://drive.google.com/file/d/your-file-id/view';
  const result = await downloader.downloadAsBuffer(url);
  
  if (result.success && result.file) {
    console.log('Downloaded:', result.fileName);
    console.log('Size:', result.size, 'bytes');
    console.log('MIME type:', result.mimeType);
    
    // Save to file
    await GoogleDriveDownloader.saveToFile(result, './downloads/myfile.pdf');
  }
}

downloadFile();
```

## API Reference

### Constructor

```javascript
const downloader = new GoogleDriveDownloader();
```

### Methods

#### `download(url, options?)`

Downloads a file from Google Drive with full control over options.

**Parameters:**
- `url` (string): Google Drive file URL
- `options` (object, optional):
  - `timeout` (number): Request timeout in milliseconds (default: 30000)
  - `maxRetries` (number): Maximum retry attempts (default: 3)
  - `exportFormat` (string): Export format for Google Docs ('original', 'pdf', 'docx', 'xlsx', 'pptx')
  - `asBuffer` (boolean): Return as buffer (true) or stream (false) (default: true)

**Returns:** Promise<IDownloadResult>

```javascript
const result = await downloader.download(url, {
  timeout: 60000,
  maxRetries: 5,
  exportFormat: 'pdf',
  asBuffer: true
});
```

#### `downloadAsBuffer(url, options?)`

Downloads a file as a buffer (convenient for saving to disk or further processing).

```javascript
const result = await downloader.downloadAsBuffer(url, {
  exportFormat: 'docx'
});
```

#### `downloadAsStream(url, options?)`

Downloads a file as a readable stream (convenient for piping or streaming).

```javascript
const result = await downloader.downloadAsStream(url);
if (result.success && result.file?.stream) {
  result.file.stream.pipe(fs.createWriteStream('output.pdf'));
}
```

#### `getFileMetadata(url)`

Gets file information without downloading.

```javascript
const metadata = await downloader.getFileMetadata(url);
console.log(metadata);
// {
//   fileId: "1ABC123...",
//   fileName: "My Document.docx",
//   mimeType: "application/vnd.google-apps.document",
//   size: 12345,
//   isGoogleDoc: true,
//   availableFormats: ["docx", "pdf", "odt", "txt"]
// }
```

#### `GoogleDriveDownloader.saveToFile(downloadResult, filePath)` (Static)

Saves a download result to the local file system.

```javascript
await GoogleDriveDownloader.saveToFile(result, './downloads/document.pdf');
```

## Supported File Types

### Regular Files
- Images (JPEG, PNG, GIF, WebP)
- PDFs
- Office documents
- Archives
- Any other file type

### Google Workspace Files
- **Google Docs** → Export as: DOCX, PDF, ODT, TXT
- **Google Sheets** → Export as: XLSX, PDF, ODS, CSV
- **Google Slides** → Export as: PPTX, PDF, ODP, TXT

## Usage Examples

### Download a Google Document as PDF

```javascript
const { GoogleDriveDownloader } = require('@raphaelvserafim/google-drive-downloader');

async function downloadGoogleDoc() {
  const downloader = new GoogleDriveDownloader();
  const url = 'https://docs.google.com/document/d/your-doc-id/edit';
  
  const result = await downloader.downloadAsBuffer(url, {
    exportFormat: 'pdf'
  });
  
  if (result.success) {
    await GoogleDriveDownloader.saveToFile(result, './document.pdf');
    console.log('✅ Document saved as PDF!');
  }
}
```

### Download a Spreadsheet as Excel

```javascript
async function downloadSpreadsheet() {
  const downloader = new GoogleDriveDownloader();
  const url = 'https://docs.google.com/spreadsheets/d/your-sheet-id/edit';
  
  const result = await downloader.downloadAsBuffer(url, {
    exportFormat: 'xlsx'
  });
  
  if (result.success) {
    await GoogleDriveDownloader.saveToFile(result, './spreadsheet.xlsx');
    console.log('✅ Spreadsheet saved as Excel!');
  }
}
```

### Stream a Large File

```javascript
const fs = require('fs');

async function streamLargeFile() {
  const downloader = new GoogleDriveDownloader();
  const url = 'https://drive.google.com/file/d/large-file-id/view';
  
  const result = await downloader.downloadAsStream(url);
  
  if (result.success && result.file?.stream) {
    const writeStream = fs.createWriteStream('./large-file.zip');
    result.file.stream.pipe(writeStream);
    
    writeStream.on('finish', () => {
      console.log('✅ Large file downloaded successfully!');
    });
  }
}
```

### Batch Download with Error Handling

```javascript
async function batchDownload(urls) {
  const downloader = new GoogleDriveDownloader();
  const results = [];
  
  for (const url of urls) {
    try {
      console.log(`Downloading: ${url}`);
      
      const result = await downloader.downloadAsBuffer(url, {
        timeout: 60000,
        maxRetries: 3
      });
      
      if (result.success) {
        const fileName = `./downloads/${result.fileName}`;
        await GoogleDriveDownloader.saveToFile(result, fileName);
        results.push({ url, success: true, fileName });
        console.log(`✅ Downloaded: ${result.fileName}`);
      } else {
        results.push({ url, success: false, error: result.error });
        console.error(`❌ Failed: ${result.error}`);
      }
      
    } catch (error) {
      results.push({ url, success: false, error: error.message });
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  return results;
}

// Usage
const urls = [
  'https://drive.google.com/file/d/file1-id/view',
  'https://docs.google.com/document/d/doc1-id/edit',
  'https://docs.google.com/spreadsheets/d/sheet1-id/edit'
];

batchDownload(urls);
```

## TypeScript Support

The library includes full TypeScript definitions:

```typescript
import { GoogleDriveDownloader, IDownloadResult, IDownloadOptions } from '@raphaelvserafim/google-drive-downloader';

const downloader = new GoogleDriveDownloader();

const options: IDownloadOptions = {
  timeout: 30000,
  exportFormat: 'pdf',
  asBuffer: true
};

const result: IDownloadResult = await downloader.download(url, options);
```

## Error Handling

The library provides detailed error information:

```javascript
const result = await downloader.downloadAsBuffer(url);

if (!result.success) {
  console.error('Download failed:', result.error);
  // Handle specific error cases
  if (result.error?.includes('timeout')) {
    // Handle timeout
  } else if (result.error?.includes('not found')) {
    // Handle file not found
  }
}
```

## Configuration

Default configuration values:
- Timeout: 30 seconds
- Max retries: 3
- Retry delay: 1 second (with exponential backoff)
- Large file timeout: 5 minutes
- Max buffer size: 100MB

## Requirements

- Node.js 20+ 
- Public Google Drive files (no authentication required)


## Common Use Cases

- **Document Processing**: Download Google Docs for text processing
- **Data Analysis**: Download Google Sheets for data processing
- **Backup Systems**: Batch download files from Google Drive
- **Content Management**: Download files for web applications
- **Report Generation**: Convert Google Docs to PDF automatically

## Limitations

- Only works with public Google Drive files
- Large files (>100MB) may require stream processing
- Rate limiting may apply for high-volume usage
- Some Google Workspace files may have export limitations

```
📦src
 ┣ 📂config
 ┃ ┗ 📜index.ts
 ┣ 📂services
 ┃ ┗ 📜downloader.ts
 ┣ 📂types
 ┃ ┗ 📜index.ts
 ┗ 📂validators
 ┃ ┗ 📜index.ts
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.