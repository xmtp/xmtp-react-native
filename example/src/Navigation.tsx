import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { TestCategory } from './tests/test-utils'

export type NavigationParamList = {
  launch: undefined
  test: { testSelection: TestCategory }
  home: undefined
  group: { id: string }
  conversation: { topic: string }
  conversationCreate: undefined
}

export const Navigator = createNativeStackNavigator<NavigationParamList>()
