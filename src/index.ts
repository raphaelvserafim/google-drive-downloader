import { GoogleDriveDownloader } from './services';

export { IDownloadResult, IDownloadOptions, IFileMetadata } from './types';
export { GoogleDriveDownloader } from './services';

export const createGoogleDriveDownloader = () => new GoogleDriveDownloader();
export const { saveToFile } = GoogleDriveDownloader;