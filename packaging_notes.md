## Overview

This document provides a detailed breakdown of how our React Native SDK is packaged.

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

The top-level npm package.json includes `"expo": "^48.0.15"` in addition to `@xmtp/react-native-sdk`. Expo is the tool that interprets and effectively "expands" the rather minimal node_module we see above.

How it does so is via a process called [Expo Autolinking](https://docs.expo.dev/modules/autolinking/). You can see the invocations to autolinking logic that are automatically added when install `expo` in your consuming project [docs](https://docs.expo.dev/bare/installing-expo-modules/).
The `expo` npm package automatically drags in the expo-modules-autolinking as a dependency, which contains the autolinking logic and scripts.

You can see one of the scripts for ios [here](https://github.com/expo/expo/blob/a2cc5e7/packages/expo-modules-autolinking/scripts/ios/autolinking_manager.rb)
Somewhere in the flow, [code](https://github.com/expo/expo/blob/a16d949041dfaad225e91c60d10e357deead141f/packages/expo-modules-autolinking/scripts/ios/react_import_patcher.rb#L17) is called via Node to [patch React imports](https://github.com/expo/expo/blob/a16d949/packages/expo-modules-autolinking/src/ReactImportsPatcher.ts) which (according to my guess) leads to the seamless import experience in React.

Let's follow this flow e2e when adding @xmtp/react-native-sdk to the [webview-based xmtp-quickstart-react-native repo](https://github.com/xmtp/xmtp-quickstart-react-native/pull/7):
1) First, we `npx install-expo-modules@latest` - this makes the appropriate changes to Android/iOS build scripts to invoke Expo Autolinking
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

