# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the XMTP React Native SDK repository - a React Native/Expo module that wraps native XMTP SDKs to enable messaging functionality in React Native applications. The project is built using Expo modules and supports both iOS and Android platforms.

## Common Development Commands

### Build & Development
- `yarn build` - Build the module using expo-module build
- `yarn clean` - Clean build artifacts
- `yarn prepare` - Prepare the module for development

### Code Quality
- `yarn lint` - Run linting (expo-module lint)
- `yarn eslint` - Run ESLint on src and example/src directories
- `yarn pretty` - Format code with Prettier
- `yarn test` - Run tests (expo-module test)

### Example App
- `cd example && yarn` - Install example app dependencies
- `yarn run ios` - Run example app on iOS (from example directory)
- `yarn run android` - Run example app on Android (from example directory)
- `yarn open:ios` - Open iOS project in Xcode
- `yarn open:android` - Open Android project in Android Studio

### Documentation
- `yarn typedoc` - Generate TypeScript documentation

## Architecture

### Core Structure
- **src/**: Main SDK source code
  - **lib/**: Core library classes (Client, Group, Dm, Conversation, etc.)
  - **context/**: React Context for XMTP integration
  - **hooks/**: React hooks for XMTP functionality
  - **NativeCodecs/**: Content type codecs for different message types
- **ios/**: iOS native implementation (Swift)
- **android/**: Android native implementation (Kotlin)
- **example/**: Full example React Native app demonstrating SDK usage

### Key Components
- **Client**: Main XMTP client for managing connections and conversations
- **Conversation**: Base class for messaging conversations
- **Group**: Group messaging functionality
- **Dm**: Direct messaging functionality  
- **XMTPModule**: Bridge between React Native and native XMTP implementations

### Native Module Bridge
The SDK uses Expo modules to bridge between React Native and native XMTP implementations. The main bridge is in `src/XMTPModule.ts` with platform-specific implementations in `ios/XMTPModule.swift` and `android/src/main/java/expo/modules/xmtpreactnativesdk/XMTPModule.kt`.

## Development Notes

### Platform Requirements
- **iOS**: Minimum iOS 16.0, requires XCode configuration
- **Android**: Minimum SDK 22
- **Node.js**: Version 20 or higher

### Testing
The example app includes comprehensive tests in `example/src/tests/` covering:
- Client functionality
- Group operations
- DM operations
- Content types
- Performance testing

### Building & Publishing
- Uses Changesets for version management
- Automated documentation updates trigger on GitHub releases
- Requires `DOCS_SYNC_TOKEN` and `ANTHROPIC_API_KEY` secrets for doc automation

### Code Review
- Pull requests are automatically reviewed by Claude AI via GitHub Actions
- Reviews focus on code quality, security, performance, and adherence to project standards
- Requires `CLAUDE_CODE_OAUTH_TOKEN` secret to be configured in repository settings

### Important Files
- `expo-module.config.json`: Expo module configuration
- `package.json`: Main package configuration with peer dependencies on Expo, React, React Native
- `example/app.json`: Example app Expo configuration
- Native platform files handle the actual XMTP protocol implementation

The SDK supports XMTP V3 (with V2 deprecated as of May 2025) and includes automated workflows for keeping documentation synchronized with releases.