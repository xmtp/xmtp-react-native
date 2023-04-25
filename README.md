# xmtp-react-native-sdk

![Lint](https://github.com/xmtp/xmtp-android/actions/workflows/lint.yml/badge.svg) ![Status](https://img.shields.io/badge/Project_Status-Pre--Preview-red)

Wrappers for native xmtp sdks for react native

> **Important:**  
> This SDK is in **Pre-Preview** status and ready for you to start experimenting with.
>
> However, we do **not** recommend using Pre-Preview software in production apps. Software in this status will change as we iterate on features and feedback.
> 
> **Specifically, this SDK currently supports Android plain text messaging only.** We're still working to support iOS and content types beyond plain text.

To keep up with the latest SDK developments, see the [Issues tab](https://github.com/xmtp/xmtp-react-native/issues) in this repo.

To learn more about XMTP and get answers to frequently asked questions, see [FAQ about XMTP](https://xmtp.org/docs/dev-concepts/faq).

![x-red-sm](https://user-images.githubusercontent.com/510695/163488403-1fb37e86-c673-4b48-954e-8460ae4d4b05.png)

## NOTES

- To use the example app, you need to `npm install --force`

# API documentation

- [Documentation for the main branch](https://github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/xmtp-react-native-sdk.md)
- [Documentation for the latest stable release](https://docs.expo.dev/versions/latest/sdk/xmtp-react-native-sdk/)

# Installation in managed Expo projects

For [managed](https://docs.expo.dev/versions/latest/introduction/managed-vs-bare/) Expo projects, please follow the installation instructions in the [API documentation for the latest stable release](#api-documentation). If you follow the link and there is no documentation available then this library is not yet usable within managed projects &mdash; it is likely to be included in an upcoming Expo SDK release.

# Installation in bare React Native projects

For bare React Native projects, you must ensure that you have [installed and configured the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) before continuing.

### Add the package to your npm dependencies

```
npm install xmtp-react-native-sdk
```

### Configure for iOS

Run `npx pod-install` after installing the npm package.

### Configure for Android

# Contributing

Contributions are very welcome! Please refer to guidelines described in the [contributing guide](https://github.com/expo/expo#contributing).
