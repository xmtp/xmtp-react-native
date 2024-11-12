# xmtp-react-native
 
![Lint](https://github.com/xmtp/xmtp-android/actions/workflows/lint.yml/badge.svg) ![Status](https://img.shields.io/badge/Project_Status-Production-brightgreen)

This repo provides a package you can use to build with XMTP in a React Native or Expo app.

Is there a feature you need that's currently supported? Please [open an issue](https://github.com/xmtp/xmtp-react-native/issues).

Or better yet, open a PR and we'll get it reviewed and merged as soon as possible. If you contribute a PR that gets merged into this repo, you'll be eligible to [claim this XMTP contributor POAP](https://www.gitpoap.io/gp/1100)!

## Documentation

To learn how to use the XMTP React Native SDK and get answers to frequently asked questions, see [XMTP documentation](https://docs.xmtp.org/).

## SDK reference

Access the [XMTP React Native SDK reference documentation](https://xmtp.github.io/xmtp-react-native/modules.html).

## Example app

Use the [XMTP React Native example app](example) as a tool to start building an app with XMTP. This basic messaging app has an intentionally unopinionated UI to help make it easier for you to build with. See [example/README.md](example/README.md) for more instructions.

### Example app quickstart

Follow the [React Native guide](https://reactnative.dev/docs/environment-setup) to set up a CLI environment.

```bash
yarn
cd example
yarn
yarn run [ios or android]
```

## Install in a managed Expo project

```bash
npx expo prebuild
```

## Install in a bare React Native project

1. Install and configure the [expo package](https://docs.expo.dev/bare/installing-expo-modules/).

2. Add the required babel plugin.

    ```bash
    yarn add @babel/plugin-proposal-export-namespace-from -D
    ```

3. Add the plugin to your `babel.config.js`.

    ```js
    module.exports = {
      presets: ['module:@react-native/babel-preset'],
      plugins: [
        '@babel/plugin-proposal-export-namespace-from',
        // ... other plugins
      ],
    };
    ```

### Add the package to your dependencies

```bash
yarn add @xmtp/react-native-sdk
```

### Configure for iOS

1. In the `ios` directory, update your `Podfile` file to set this value: `platform :ios, '16.0'`. This is required by XMTP.

2. Run:

    ```bash
    npx pod-install
    ```

If you get the error `The SQLCipher Sqlite extension is not present, but an encryption key is given`, at the project configuration level in XCode, ensure that `xmtpV3` is loaded before all other packages by setting `Other Linker Flags` first item to `-l"xmtpv3"`.

### Configure for Android

Your app must use Android `minSdkVersion = 22` to work with the `xmtp-react-native` SDK.

## 🏗 Breaking revisions

Because `xmtp-react-native` is in active development, you should expect breaking revisions that might require you to adopt the latest SDK release to enable your app to continue working as expected.

XMTP communicates about breaking revisions in the [XMTP Discord community](https://discord.gg/xmtp), providing as much advance notice as possible. Additionally, breaking revisions in an `xmtp-react-native` release are described on the [Releases page](https://github.com/xmtp/xmtp-react-native/releases).

### Deprecation

Older versions of the SDK will eventually be deprecated, which means:

1. The network will not support and eventually actively reject connections from clients using deprecated versions.
2. Bugs will not be fixed in deprecated versions.

Following table shows the deprecation schedule.

| Announced  | Effective  | Minimum Version | Rationale                                                                                                         |
| ---------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2022-08-18 | 2022-11-08 | v6.0.0          | XMTP network will stop supporting the Waku/libp2p based client interface in favor of the new GRPC based interface |

Issues and PRs are welcome in accordance with our [contribution guidelines](https://github.com/xmtp/.github/blob/main/CONTRIBUTING.md).
