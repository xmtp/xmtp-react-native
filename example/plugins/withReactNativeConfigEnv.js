/**
 * Expo config plugin: injects react-native-config's dotenv.gradle into the Android app build
 * so that .env is loaded into BuildConfig and Config.* works on Android (same as iOS).
 * Without this, env vars work on iOS but not Android after prebuild.
 *
 * @see https://github.com/luggit/react-native-config#android
 */
const { withAppBuildGradle } = require('expo/config-plugins')

const DOTENV_LINE =
  'apply from: project.file("../../node_modules/react-native-config/android/dotenv.gradle")'
const COMMENT =
  '// Load .env into BuildConfig so react-native-config Config.* works on Android (required for env vars in JS)'

function withReactNativeConfigEnv(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents
    if (contents.includes('react-native-config/android/dotenv.gradle')) {
      return config
    }
    const afterPlugins = contents.indexOf('apply plugin: "com.facebook.react"')
    if (afterPlugins === -1) {
      return config
    }
    const insertAt = contents.indexOf('\n', afterPlugins) + 1
    const before = contents.slice(0, insertAt)
    const after = contents.slice(insertAt)
    config.modResults.contents =
      before + '\n' + COMMENT + '\n' + DOTENV_LINE + '\n\n' + after
    return config
  })
}

module.exports = withReactNativeConfigEnv
