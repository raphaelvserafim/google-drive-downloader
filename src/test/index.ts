

import { createGoogleDriveDownloader } from "..";

const downloader = createGoogleDriveDownloader();

downloader.download("https://drive.google.com/file/d/ss/view").then((result) => {
    console.log("Download successful:", result);
}).catch((error) => {
    console.error("Download failed:", error);
});