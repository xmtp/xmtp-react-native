import ReactNativeBlobUtil from 'react-native-blob-util'

// This contains a naive storage implementation.
// It uses a simple HTTP server to POST and GET files.
// It is not intended for production use, but is useful for testing and development.
// See `dev/local/upload-service`

const useLocalServer = !process.env.REACT_APP_USE_LOCAL_SERVER
const storageUrl = useLocalServer
  ? 'https://localhost:8443'
  : process.env.REACT_APP_STORAGE_URL
const headers = {
  'Content-Type': 'application/octet-stream',
}

export async function uploadFile(
  localFileUri: string,
  fileId: string | undefined
): Promise<string> {
  const url = `${storageUrl}/${fileId}`
  console.log('uploading to', url)

  try {
    await ReactNativeBlobUtil.config({
      fileCache: true,
      trusty: useLocalServer,
    }).fetch(
      'POST',
      url,
      headers,
      ReactNativeBlobUtil.wrap(localFileUri.slice('file://'.length))
    )
  } catch (error) {
    console.error(
      'Error during file upload:',
      error,
      'Did you run the `yarn run upload:up` command from the xmtp-react-native/example directory?',
      'Did you run `adb reverse tcp:8443 tcp:8443` if testing on Android?'
    )
    throw error
  }

  return url
}

export async function downloadFile(url: string): Promise<string> {
  console.log('downloading from', url)

  const res = await ReactNativeBlobUtil.config({
    fileCache: true,
    trusty: true,
    timeout: 30000,
  }).fetch('GET', url)

  console.log('Download complete:', {
    status: res.info().status,
    path: res.path(),
  })

  return `file://${res.path()}`
}
