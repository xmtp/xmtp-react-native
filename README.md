# xmtp-react-native
 
![Test](https://github.com/xmtp/xmtp-react-native/actions/workflows/test.yml/badge.svg) ![Lint](https://github.com/xmtp/xmtp-android/actions/workflows/lint.yml/badge.svg)

This repo provides a package you can use to build with XMTP in a React Native or Expo app.

Is there a feature you need that's currently supported? Please [open an issue](https://github.com/xmtp/xmtp-react-native/issues).

Or better yet, open a PR and we'll get it reviewed and merged as soon as possible. If you contribute a PR that gets merged into this repo, you'll be eligible to [claim this XMTP contributor POAP](https://www.gitpoap.io/gp/1100).

## Documentation

To learn how to use the XMTP React Native SDK, see [Get started with the XMTP React Native SDK](https://docs.xmtp.org/sdks/react-native).

## SDK reference

Access the [XMTP React Native SDK reference documentation](https://xmtp.github.io/xmtp-react-native/modules.html).

## Automated Documentation Updates

This repository includes an automated workflow that updates the XMTP documentation when new releases are published. The workflow:

- Triggers on every tagged GitHub release
- Analyzes changes in the release to detect API modifications
- Updates version references in the [xmtp/docs-xmtp-org](https://github.com/xmtp/docs-xmtp-org) repository
- Validates React Native code samples in the documentation
- Creates a pull request with the updates

### Setup Requirements

To enable the documentation update workflow, ensure the following repository secrets are configured:

- `DOCS_SYNC_TOKEN`: A GitHub personal access token with write access to the `xmtp/docs-xmtp-org` repository
- `ANTHROPIC_API_KEY`: An Anthropic API key for Claude Code Actions integration

### Manual Trigger

The workflow can also be triggered manually via the Actions tab with an optional tag name parameter to analyze a specific release.

The workflow will automatically run when releases are published and create PRs to keep the documentation current with the latest SDK changes.

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

Breaking revisions in an `xmtp-react-native` release are described on the [Releases page](https://github.com/xmtp/xmtp-react-native/releases).

## Deprecation

XMTP communicates about deprecations in the [XMTP Community Forums](https://community.xmtp.org/), providing as much advance notice as possible.

Older versions of the SDK will eventually be deprecated, which means:

1. The network will not support and eventually actively reject connections from clients using deprecated versions.
2. Bugs will not be fixed in deprecated versions.

The following table provides the deprecation schedule.

| Announced              | Effective     | Minimum Version | Rationale                                                                                                                                                                  |
|------------------------|---------------|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| No more support for XMTP V2 | May 1, 2025 | >=4.0.2           | In a move toward better security with MLS and the ability to decentralize, we will be shutting down XMTP V2 and moving entirely to XMTP V3. To learn more about V2 deprecation, see [XIP-53: XMTP V2 deprecation plan](https://community.xmtp.org/t/xip-53-xmtp-v2-deprecation-plan/867). To learn how to upgrade, see [xmtp-react-native v4.0.2](https://github.com/xmtp/xmtp-react-native/releases/tag/v4.0.2). For reference, you can view the [legacy branch](https://github.com/xmtp/xmtp-react-native/tree/xmtp-legacy). |

Issues and PRs are welcome in accordance with [XMTP contribution guidelines](https://github.com/xmtp/.github/blob/main/CONTRIBUTING.md).
