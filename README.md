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
