import { createNativeStackNavigator } from '@react-navigation/native-stack'

export type NavigationParamList = {
  launch: undefined
  test: undefined
  home: undefined
  conversation: { topic: string }
  conversationCreate: undefined
}

export const Navigator = createNativeStackNavigator<NavigationParamList>()
