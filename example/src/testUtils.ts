import { Platform } from 'react-native'

const getPlatformTestId = (id: string) =>
  Platform.OS === 'ios'
    ? { testID: id }
    : { accessible: true, accessibilityLabel: id }

/**
 * Adds a testID to the views on Android and iOS in their specific ways. On Android,
 * this will result in a ContentDescription on Debug builds (and no changes on live builds).
 */
const setTestID = (id: string) => (__DEV__ ? getPlatformTestId(id) : null)

export default setTestID
