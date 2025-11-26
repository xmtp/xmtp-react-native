# XMTP React Native example app

This basic messaging app has an intentionally unopinionated UI to help make it easier for you to build with.

## Run the example app

Follow the [React Native guide](https://reactnative.dev/docs/environment-setup) to set up a CLI environment.

### To use the example app, run:

```bash
yarn
cd example
yarn
yarn run [ios or android]
```

### If testing the remote attachment content type, run (from example directory):

```bash
yarn run upload:up
```

If running on andoid also run:

```bash
adb reverse tcp:8443 tcp:8443
```

To clean up after testing you can run:

```bash
yarn run upload:down
```

### Configure ThirdWeb Client API

> Note - The connect wallet button will still work without adding a client id, you just may see some extra network errors when viewing account info in the Thirdweb button after connecting.

First create a free account and download your client id from https://thirdweb.com/dashboard/settings/api-keys. Next create your .env file in the example directory

```
cd example
cp EXAMPLE.env .env
```

Finally, insert your Thirdweb client id in specified location of `example/.env` file:

```
THIRD_WEB_CLIENT_ID=INSERT_CLIENT_ID_HERE
```

If your app doesn't appear to be picking up changes in the .env file, you can try editing the TypeScript file you're reading the env variable from (`App.tsx`) or building the app with the `--no-build-cache` flag added.

## Run example app unit tests on local emulators

Running tests locally is useful when updating GitHub actions, or locally testing between changes.

1. [Install Docker](https://docs.docker.com/get-started/get-docker/)

2. Start a local XMTP server
   ```bash
   git clone https://github.com/xmtp/libxmtp.git
   cd libxmtp
   dev/up
   ```
3. Verify the XMTP server is running

   ```bash
   docker-compose ls

   NAME                STATUS              CONFIG FILES
   libxmtp             running(9)          <REPO_DIRECTORY>/libxmtp/dev/docker/docker-compose.yml
   ```

4. You can now run unit tests on your local emulators
5. You can stop the XMTP server with the following command:
   ```bash
   dev/down
   ```
