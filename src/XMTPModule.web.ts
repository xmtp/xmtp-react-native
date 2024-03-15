import { NativeEventEmitter } from 'react-native'

const emitter = new NativeEventEmitter({} as any)

export default {
  PI: Math.PI,
  async setValueAsync(value: string): Promise<void> {
    emitter.emit('onChange', { value })
  },
  hello() {
    return 'Hello world! 👋'
  },
}
