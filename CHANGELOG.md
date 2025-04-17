# @xmtp/react-native-sdk

## 4.0.4

### Patch Changes

- 1db431b: Adjust cursor updates in message processing to prevent potential forked groups

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
