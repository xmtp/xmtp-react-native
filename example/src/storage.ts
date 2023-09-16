import ReactNativeBlobUtil from "react-native-blob-util";

// This contains a naive storage implementation.
// It uses a simple HTTP server to POST and GET files.
// It is not intended for production use, but is useful for testing and development.
// See `dev/local/upload-service`

const storageUrl = process.env.REACT_APP_STORAGE_URL || "https://localhost";
const headers = {
  "Content-Type": "application/octet-stream",
};

export async function uploadFile(
  localFileUri: `file://${string}`,
  fileId: string,
): Promise<string> {
  let url = `${storageUrl}/${fileId}`;
  console.log("uploading to", url);
  await ReactNativeBlobUtil.config({ fileCache: true }).fetch(
    "POST",
    url,
    headers,
    ReactNativeBlobUtil.wrap(localFileUri.slice("file://".length)),
  );
  return url;
}

export async function downloadFile(url: string): Promise<string> {
  console.log("downloading from", url);
  let res = await ReactNativeBlobUtil.config({ fileCache: true }).fetch(
    "GET",
    url,
  );
  return `file://${res.path()}`;
}
