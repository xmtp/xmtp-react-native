---
"@xmtp/react-native-sdk": patch
---

4.5.0 release
- **BREAKING CHANGE**: `XMTPPush` `subscribe()` was updated to be `async` to account for core library database calls
- Faster syncing of new groups: new welcome message cursor enables skipping attempts at decrypting old messages (https://github.com/xmtp/libxmtp/pull/2088) @mchenani @codabrink 
- Lens chain Smart Contract Wallet verifier support  (https://github.com/xmtp/libxmtp/pull/2419) @mennatnaga 
- OpenMLS fix for persistence during message processing (https://github.com/xmtp/libxmtp/pull/2498) @richardhuaaa 
- Fix for lifetime validation gaps (https://github.com/xmtp/libxmtp/pull/2502) @richardhuaaa 
