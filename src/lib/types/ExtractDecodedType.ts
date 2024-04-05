import { ContentCodec } from './ContentCodec'

export type ExtractDecodedType<C> = C extends ContentCodec<infer T> ? T : never
