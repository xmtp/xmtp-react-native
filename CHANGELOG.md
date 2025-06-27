# @xmtp/react-native-sdk

## 4.2.5

### Patch Changes

- cfb923f: - Fixes for known bugs that could cause forking
  - Statically manage revoking installations signatures

## 4.2.4

### Patch Changes

- 1a3668f: - Adds ability to revoke installations statically

## 4.2.3

### Patch Changes

- 414bfc2: - Added ability to clear network stats
  - Added option to build clients offline
  - Fixed 2 issues that could cause groups to fork
  - Increased group size to 250 members
  - Added limit of 5 installations per inbox

## 4.2.2

### Patch Changes

- 61cb5ae: Fix consent wrapper json parsing

## 4.2.1

### Patch Changes

- dfc1547: - Add the ability to set array of consent states

## 4.2.0

- Release 4.2.0
- Adds KeyPackage status to debug information

## 4.2.0-rc5

### Pre Release

- Fixes HPKE race condition on processing welcomes

## 4.2.0-rc4

### Pre Release

- Adds statistics for network activity
- Adds ability to upload a debug package
- Fixes hmac keys for duplicate dms
- Fixes support for 16KB Android devices

## 4.2.0-rc3

### Pre Release

- Fix for DB Migration issue

## 4.2.0-rc2

### Pre Release

- Adds the ability to get all topics including duplicate dms for conversations
- Adds ability to get all topics for a individual conversation
- Adds ability to filter consent state from streamAll
- Adds extra logging to signingkey errors
- Adds ability to get HmacKeys for a individual conversation
- Bumps bindings to latest
- Add conversation debug information
- Add history sync testing
- Optimistic group creation

## 4.0.3

### Patch Changes

- a7d1e76: - Fixes legacy db paths

## 4.0.2

### Patch Changes

- 53a3917: - Fix invalid key packages

## 4.0.1

### Patch Changes

- 267a30c: Refactored welcome message processing to prevent key package deletion on failure

## 4.0.0

### Major Changes

- af11736: - 4.0.0 Release

## 4.0.0-rc2

### Pre Release

- Fixed SCW signatures
- Adds ability to extend to passkey signatures in the future

## 4.0.0-rc1

### Pre Release

- New PublicIdentity replacing all places that used address
- Changes addMember, removeMember, createGroup, and newConversation to default to InboxId
- Remove App Version from client
- Rename imageUrlSquare to imageUrl
- Group removed from names inside group class
- Renamed ConversationType to ConversationFilterType

## 3.1.17

### Patch Changes

- e0e92b3: - adds `should_push` to messages for push notifications handling
  - fixes occasional rust panic crash in streams

## 3.1.16

### Patch Changes

- ca4653e: remove drop db connection on background on ios

## 3.1.15

### Patch Changes

- 404902f: Granular Control Over Creation Flow

## 3.1.14

### Patch Changes

- a1af1d4: - Create errors instead of promise hanging.
  - Stream fixes for reliability

## 3.1.13

### Patch Changes

- 05592eb: Disappearing Messages
  DM membership adds (increases message length by 1 for dm creators)
  Bug fix key package issues
  Bug fix rate limiting
  Mark addAccount as a delicate API

## 3.1.12

### Patch Changes

- c85ff9e: Fix streaming issue

## 3.1.11

### Patch Changes

- 4548cee: Remove pinned frame url

## 3.1.10

### Patch Changes

- 2998faa: Revert client removal

## 3.1.9

### Patch Changes

- 29f8783: fixes exportNativeLogs on iOS

## 3.1.8

### Patch Changes

- 8c15ef6: - Add ability to filter and sync by multiple consents
  - And new inboxId methods for performance
  - Conversation list sort by last "readable" msg
  - Default msg history off

## 3.1.7

### Patch Changes

- e5839cd: - Remove client from serializable objects
  - Ability to revoke installations
  - Static inboxStates for inboxIds

## 3.1.6

### Patch Changes

- fb1f351: V3 HMAC key support for self push notifications
  Streaming preference updates

## 3.1.5

### Patch Changes

- db4e926: - Re-Enable History Sync
  - Continued Performance improvements

## 3.1.4

### Patch Changes

- 5dbd79e: Speed up build client performance
  Adds ability to filter syncAllConversations by consent state
  Fixes potential forked group issues
  Renames senderAddress to senderInboxId

## 3.1.3

### Patch Changes

- ffa3d9a: Add custom content types for preparing a message
- 57ce753: Fix for forked groups via intent filter adjustment
- bcd7c68: update node versions

## 3.1.2

### Patch Changes

- cacd7ed: Add back custom content types.
- e014d34: - Add back custom content types
  - Set node to 20 and fix release action
