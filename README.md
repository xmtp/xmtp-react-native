# xmtp-react-native

![Lint](https://github.com/xmtp/xmtp-android/actions/workflows/lint.yml/badge.svg) ![Status](https://img.shields.io/badge/Project_Status-Pre--Preview-red)

This repo provides a package you can use to build with XMTP in a React Native or Expo app.

> **Important:**  
> This SDK is in **Pre-Preview** status and ready for you to start experimenting with.
>
> However, we do **not** recommend using Pre-Preview software in production apps. Software in this status will change as we add features and iterate based on feedback.

Currently, these are the features supported by this SDK:

- Create a `Client` from an ethers `Signer`
- List conversations
- List messages (unpaginated for now) in a conversation
- Start a conversation
- The SDK connects to the `dev` environment only. We are working on support for connecting to `production` and `local` environments. You can follow the work in [this issue](https://github.com/xmtp/xmtp-react-native/issues/4).

We're still working on adding several features to bring this SDK to parity with the [XMTP client SDK for JavaScript](https://github.com/xmtp/xmtp-js) (`xmtp-js`). Here's a [list of features and issues](https://github.com/xmtp/xmtp-react-native/issues) we're working on.

Is there a feature you need that's not on the list? Please [open an issue](https://github.com/xmtp/xmtp-react-native/issues).

Or better yet, open a PR and we'll get it reviewed and merged as soon as possible. If you contribute a PR that gets merged into this repo, you'll be eligible to [claim this XMTP contributor POAP](https://www.gitpoap.io/gp/1042)!

To learn more about XMTP and get answers to frequently asked questions, see [FAQ about XMTP](https://xmtp.org/docs/dev-concepts/faq).

![x-red-sm](https://user-images.githubusercontent.com/510695/163488403-1fb37e86-c673-4b48-954e-8460ae4d4b05.png)

## Example app

This repo provides an [example app](example) that you can use to experiment and explore implementation details.

To use the example app, run:

```bash
cd example
npm install --force
npm run [ios or android]
```

## Install in a managed Expo project

```bash
npx expo prebuild
```

## Install in bare React Native project

For bare React Native projects, [install and configure the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) before continuing.

### Add the package to your npm dependencies

```bash
npm i @xmtp/react-native-sdk
```

### Configure for iOS

```bash
npx pod-install
```

We're working on testing the end-to-end installation and will provide more platform-specific configuration details.

### Configure for Android

Your app must use Android `minSdkVersion = 22` to work with the `xmtp-react-native` SDK.

We're working on testing the end-to-end installation and will provide more platform-specific configuration details.

## Enable the example app to send push notifications

You can use a Firebase Cloud Messaging server and an example push notification server to enable the `xmtp-react-native` example app to send push notifications.

Perform this setup to understand how you might want to enable push notifications for your own app built with the `xmtp-react-native` SDK.

### Set up a Firebase Cloud Messaging server

For this tutorial, we'll use [Firebase Cloud Messaging](https://console.firebase.google.com/) (FCM) as a convenient way to set up a messaging server.

1. Create an FCM project.

2. Add the example app to the FCM project. This generates a `google-services.json` file that you need in subsequent steps.

3. Add the `google-services.json` file to the example app's project as described in the FCM project creation process.

4. Generate FCM credentials, which you need to run the example notification server. To do this, from the FCM dashboard, click the gear icon next to **Project Overview** and select **Project settings**. Select **Service accounts**. Select **Go** and click **Generate new private key**. 

### Run an example notification server

Now that you have an FCM server set up, take a look at the [export-kotlin-proto-code](https://github.com/xmtp/example-notification-server-go/tree/np/export-kotlin-proto-code) branch in the `example-notifications-server-go` repo. 

This example branch can serve as the basis for what you might want to provide for your own notification server. The branch also demonstrates how to generate the proto code if you decide to perform these tasks for your own app. This proto code from the example notification server has already been generated in the `xmtp-android` example app.

**To run a notification server based on the example branch:**

1. Clone the [example-notification-server-go](https://github.com/xmtp/example-notification-server-go) repo.

2. Complete the steps in [Local Setup](https://github.com/xmtp/example-notification-server-go/blob/np/export-kotlin-proto-code/README.md#local-setup).

3. Get the FCM project ID and FCM credentials you created earlier and run:

    ```bash
      YOURFCMJSON=`cat YOURFIREBASEADMINFROMSTEP4.json` 
    ```

    ```bash
    dev/run \                                                                     
    --xmtp-listener-tls \
    --xmtp-listener \
    --api \
    -x "production.xmtp.network:5556" \
    -d "postgres://postgres:xmtp@localhost:25432/postgres?sslmode=disable" \
    --fcm-enabled \
    --fcm-credentials-json=$YOURFCMJSON \
    --fcm-project-id="YOURFCMPROJECTID"
    ```

4. You should now be able to see push notifications coming across the local network.

### Update the Android example app to send push notifications

1. Add your `google-services.json` file to the `example/android/app` folder if you haven't already done it as a part of the FCM project creation process.

2. Uncomment `apply plugin: 'com.google.gms.google-services'` in the example app's `build.gradle` file.

3. Uncomment `classpath('com.google.gms:google-services:4.3.15')` in the top level of the example app's `build.gradle` file.

4. Sync the gradle project.

5. Replace `YOUR_SERVER_ADDRESS` in the `PullController.ts` file. If you're using the example notification server, it should be something like `YOURIPADDRESS:8080` since the Android emulator takes over localhost.

6. Change the example app's environment to `production` in both places in `AuthView.tsx`.

7. Replace `YOUR_FIREBASE_SENDER_ID` in the `PullController.ts` with your sender ID from Firebase.

### Update the iOS example app to send push notifications

Coming soon.
