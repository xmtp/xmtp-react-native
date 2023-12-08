# XMTP React Native example app

This basic messaging app has an intentionally unopinionated UI to help make it easier for you to build with.

## Run the example app
Follow the [React Native guide](https://reactnative.dev/docs/environment-setup) to set up a CLI environment.

To use the example app, run:

```bash
npm install
cd example
npm install --force
npm run [ios or android]
```

## Run example app unit tests on local emulators
Running tests locally is useful when updating GitHub actions, or locally testing between changes.

1. [Install Docker](https://docs.docker.com/get-docker/)

2. Start a local XMTP server (from example directory)
    ```bash
    docker-compose -p xmtp -f dev/local/docker-compose.yml up -d
    ```
3. Verify XMTP server is running
    ```bash
    docker-compose ls

    NAME                STATUS              CONFIG FILES
    xmtp                running(3)          <REPO_DIRECTORY>/xmtp-react-native/example/dev/local/docker-compose.yml
    ```
4. You can now run unit tests on your local emulators
5. You can stop the XMTP server with the following command:
    ```bash
    docker-compose -p xmtp -f dev/local/docker-compose.yml down
    ```