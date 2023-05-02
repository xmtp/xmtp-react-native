## Overview

This document provides a detailed breakdown of how our React Native SDK is packaged. The SDK is an Expo Module (XMTPModule) with a shared Typescript interface backed by Kotlin/Swift wrapper code utilizing the xmtp-ios and xmtp-android platform-specific SDKs.
These are the same SDKs that native iOS or Android apps would use, but are wrapped together and used to implement a shared interface for this React Native SDK.

## Diagram

```
   Your ReactNative App
   |-> "import { Client } from '@xmtp/react-native-sdk';"
    |-> NPM (node_modules)
     |-> Expo (installed as npm module)
      |-> expo-modules-autolinking
      |-> `npm install @xmtp/react-native-sdk` saves files to node_modules
       |-> iOS (at build time)
       | |-> autolinking script added to Podfile (and minIOS set to 13.0) as part of expo npm install
       | |-> autolinking script executes as part of pod install
       | |-> finds @xmtp/react-native-sdk/expo-module.config.json
       |  |-> Resolves need for `XMTP` Cocoapod
       |   |-> This is the Cocoapod published from `xmtp-ios` (canonical iOS XMTP SDK, used by native iOS projects directly)
       |   |-> Installs the `XMTP` Cocoapod
       |  |-> Runs code to patch React imports, finish up iOS-specific (TODO flush out more)
       |
       |-> Android (at build time)
        |-> autolinking script added to settings.gradle as part of expo npm install
         |-> executes as part of Gradle build
         |-> finds @xmtp/react-native-sdk/expo-module.config.json
          |-> Resolves reference to `org.xmtp.android`
           |-> This is an artifact published from `xmtp-android` (canonical Android XMTP SDK, used by Android projects direclty)
           |-> Gradle finds `org.xmtp.android` in whatever repositories are configured (Maven, etc)
            |-> Fetches `org.xmtp.android` jar files and metadata
           |-> Finishes Android-specific module setup
```

## What all is being packaged for NPM?

Our React Native SDK relies on [Expo](https://expo.dev/). Practically, this involves an `expo` NPM package which edits Android/iOS build files upon install. Expo then does its own resolution of Cocoapods and Android artifacts, links that to the Typescript code in this SDK and provides a nice clean import interface for consumers. Consumers just have to `npm install @xmtp/react-native-sdk`, include some platform-specific build tweaks (we're working to remove, like minIOS version, modular headers etc), and they're good to go.

This means our NPM package is pretty light. It contains Typescript code that implements a nice `XMTP` interface, and then per-platform manifests that tell Expo what to look for in Cocoapods / Maven to find native code.

## Expo Detailed Walkthrough

The top-level npm package.json includes `"expo": "^48.0.15"` in addition to `@xmtp/react-native-sdk`. Expo is the tool that interprets and effectively "expands" the rather minimal node_module we see above.

How it does so is via a process called [Expo Autolinking](https://docs.expo.dev/modules/autolinking/). You can see the invocations to autolinking logic that are automatically added when install `expo` in your consuming project [docs](https://docs.expo.dev/bare/installing-expo-modules/).
The `expo` npm package automatically drags in the expo-modules-autolinking as a dependency, which contains the autolinking logic and scripts.

You can see one of the scripts for ios [here](https://github.com/expo/expo/blob/a2cc5e7/packages/expo-modules-autolinking/scripts/ios/autolinking_manager.rb)
Somewhere in the flow, [code](https://github.com/expo/expo/blob/a16d949041dfaad225e91c60d10e357deead141f/packages/expo-modules-autolinking/scripts/ios/react_import_patcher.rb#L17) is called via Node to [patch React imports](https://github.com/expo/expo/blob/a16d949/packages/expo-modules-autolinking/src/ReactImportsPatcher.ts) which (according to my guess) leads to the seamless import experience in React.

Let's follow this flow e2e when adding @xmtp/react-native-sdk to the [webview-based xmtp-quickstart-react-native repo](https://github.com/xmtp/xmtp-quickstart-react-native/pull/7):

### Step 1) Install expo modules

First, we `npx install-expo-modules@latest` - this makes the appropriate changes to Android/iOS build scripts to invoke Expo Autolinking, adds the expo module to node_modules

```
diff --git a/android/settings.gradle b/android/settings.gradle
index d6fc944..92f39b1 100644
--- a/android/settings.gradle
+++ b/android/settings.gradle
@@ -2,3 +2,6 @@ rootProject.name = 'XMTPQuickStartReactNative'
 apply from: file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle"); applyNativeModulesSettingsGradle(settings)
 include ':app'
 includeBuild('../node_modules/react-native-gradle-plugin')
+
+apply from: new File(["node", "--print", "require.resolve('expo/package.json')"].execute(null, rootDir).text.trim(), "../scripts/autolinking.gradle")
+useExpoModules()
\ No newline at end of file
diff --git a/ios/Podfile b/ios/Podfile
index 27bbfc7..09bba4c 100644
--- a/ios/Podfile
+++ b/ios/Podfile
@@ -1,7 +1,8 @@
+require File.join(File.dirname(`node --print "require.resolve('expo/package.json')"`), "scripts/autolinking")
 require_relative '../node_modules/react-native/scripts/react_native_pods'
 require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'

-platform :ios, min_ios_version_supported
+platform :ios, '13.0'
 prepare_react_native_project!

 # If you are using a `react-native-flipper` your iOS build will fail when `NO_FLIPPER=1` is set.
@@ -22,6 +23,14 @@ if linkage != nil
 end

 target 'XMTPQuickStartReactNative' do
+  use_expo_modules!
+  post_integrate do |installer|
+    begin
+      expo_patch_react_imports!(installer)
+    rescue => e
+      Pod::UI.warn e
+    end
+  end
   config = use_native_modules!

   # Flags change depending on the env values.
```
### Step 2) Install @xmtp/react-native-sdk npm package

Run `yarn add @xmtp/react-native-sdk`

Here is the layout of and older version of the `@xmtp/react-native-sdk` npm module in the `node_modules` folder after install
```
(base) ➜  react-native-sdk git:(expo-test) ✗ tree
.
├── README.md
├── android
│   ├── build.gradle
│   └── src
│       └── main
│           ├── AndroidManifest.xml
│           └── java
│               └── expo
│                   └── modules
│                       └── xmtpreactnativesdk
│                           ├── XMTPModule.kt
│                           └── wrappers
│                               ├── ConversationWrapper.kt
│                               └── DecodedMessageWrapper.kt
├── build
│   ├── XMTP.types.d.ts
│   ├── XMTP.types.d.ts.map
│   ├── XMTP.types.js
│   ├── XMTP.types.js.map
│   ├── XMTPModule.d.ts
│   ├── XMTPModule.d.ts.map
│   ├── XMTPModule.js
│   ├── XMTPModule.js.map
│   ├── XMTPModule.web.d.ts
│   ├── XMTPModule.web.d.ts.map
│   ├── XMTPModule.web.js
│   ├── XMTPModule.web.js.map
│   ├── XMTPView.d.ts
│   ├── XMTPView.d.ts.map
│   ├── XMTPView.js
│   ├── XMTPView.js.map
│   ├── XMTPView.web.d.ts
│   ├── XMTPView.web.d.ts.map
│   ├── XMTPView.web.js
│   ├── XMTPView.web.js.map
│   ├── index.d.ts
│   ├── index.d.ts.map
│   ├── index.js
│   ├── index.js.map
│   └── lib
│       ├── Client.d.ts
│       ├── Client.d.ts.map
│       ├── Client.js
│       ├── Client.js.map
│       ├── Conversation.d.ts
│       ├── Conversation.d.ts.map
│       ├── Conversation.js
│       ├── Conversation.js.map
│       ├── Conversations.d.ts
│       ├── Conversations.d.ts.map
│       ├── Conversations.js
│       ├── Conversations.js.map
│       ├── DecodedMessage.d.ts
│       ├── DecodedMessage.d.ts.map
│       ├── DecodedMessage.js
│       ├── DecodedMessage.js.map
│       ├── util.d.ts
│       ├── util.d.ts.map
│       ├── util.js
│       └── util.js.map
├── expo-module.config.json
├── ios
│   ├── Wrappers
│   │   ├── ConversationWrapper.swift
│   │   ├── DecodedMessageWrapper.swift
│   │   └── Wrapper.swift
│   ├── XMTPModule.swift
│   └── XMTPReactNative.podspec
├── package.json
├── src
│   ├── XMTP.types.ts
│   ├── XMTPModule.ts
│   ├── XMTPModule.web.ts
│   ├── XMTPView.tsx
│   ├── XMTPView.web.tsx
│   ├── index.ts
│   └── lib
│       ├── Client.ts
│       ├── Conversation.ts
│       ├── Conversations.ts
│       ├── DecodedMessage.ts
│       └── util.ts
└── tsconfig.json

14 directories, 69 files
```

The expo-module.config.json contains:
```
{
  "platforms": ["ios", "android", "web"],
  "ios": {
    "modules": ["XMTPModule"]
  },
  "android": {
    "modules": ["expo.modules.xmtpreactnativesdk.XMTPModule"]
  }
}
```

Each of those platform-specific module repos contain a platform-specific build manifest (podspec or build.gradle).
These files (build.gradle, XMTPReactNative.podspec) reference the XMTP Android and iOS SDKs respectively:
```
# Android
  implementation "org.xmtp:android:0.1.1"
# iOS
  s.dependency "XMTP", "= 0.1.3-beta0"
```
These SDKs are wrapped by the Kotlin/Swift files in the xmtp-react-native repository, and surfaced into JS land. Our example project just consumes the Typescript API provided by xmtp/xmtp-react-native/src
```
...
├── src
│   ├── XMTP.types.ts
│   ├── XMTPModule.ts
│   ├── XMTPModule.web.ts
│   ├── XMTPView.tsx
│   ├── XMTPView.web.tsx
│   ├── index.ts
│   └── lib
│       ├── Client.ts
│       ├── Conversation.ts
│       ├── Conversations.ts
│       ├── DecodedMessage.ts
│       └── util.ts
...
```
