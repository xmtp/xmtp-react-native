import { content } from '@xmtp/proto'
import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'
import { PreferenceUpdates } from 'xmtp-react-native-sdk/lib/PrivatePreferences'

import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  adaptEthersWalletToSigner,
  assertEqual,
} from './test-utils'
import {
  Client,
  ConsentRecord,
  Conversation,
  ConversationId,
  conversationMessages,
  conversationMessagesWithMetrics,
  ConversationVersion,
  FullMetrics,
  JSContentCodec,
} from '../../../src/index'

export const conversationTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  conversationTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

type EncodedContent = content.EncodedContent
type ContentTypeId = content.ContentTypeId

test('test message retrieval performance', async () => {
  const NUM_GROUPS = 5; 
  const MESSAGES_PER_GROUP = 50; // Reduced from 50 for quicker test
  const MAX_FIND_MESSAGES_TIME_MS = 1000; // 1 second max allowed time

  // Create two test clients
  const [alice, bob] = await createClients(2)
  
  // Create groups and populate them with messages
  const aliceGroups: Conversation<any>[] = [];
  
  console.log(`Creating ${NUM_GROUPS} groups with ${MESSAGES_PER_GROUP} messages each...`);
  
  for (let i = 0; i < NUM_GROUPS; i++) {
    const groupName = `Test Group ${i}`;
    
    // Alice creates the group and adds Bob
    const aliceGroup = await alice.conversations.newGroup([bob.inboxId]);
    
    aliceGroups.push(aliceGroup);
    
    await bob.conversations.syncAllConversations();
    
    // Wait for bob to receive the welcome message
    let bobGroups = await bob.conversations.list();
    
    // Wait until Bob has the group
    let attempts = 0;
    while (bobGroups.length <= i && attempts < 10) {
      await delayToPropogate(100);
      bobGroups = await bob.conversations.list();
      attempts += 1;
    }
    
    if (bobGroups.length <= i) {
      throw new Error(`Bob did not receive the welcome message for group ${i}`);
    }
    
    const bobGroup = bobGroups.find(group => group.id === aliceGroups[i].id);
    
    if (!bobGroup) {
      throw new Error(`Bob could not find group with id ${aliceGroups[i].id}`);
    }
    
    // Send messages alternating between Alice and Bob
    console.log(`Populating group ${i} with ${MESSAGES_PER_GROUP} messages...`);
    
    for (let j = 0; j < MESSAGES_PER_GROUP; j++) {
      const msg = `Message ${j} from ${j % 2 === 0 ? 'Alice' : 'Bob'}`;
      
      if (j % 2 === 0) {
        await aliceGroups[i].send(msg);
      } else {
        await bobGroup.send(msg);
      }
      
      // if (j % 10 === 0) {
      //   // Sync periodically to avoid message queue issues
      //   await aliceGroups[i].sync();
      //   await bobGroup.sync();
      // }
    }
    
    // Final sync to ensure all messages are processed
    await aliceGroups[i].sync();
    await bobGroup.sync();
    
    console.log(`Finished creating group ${i} with ${MESSAGES_PER_GROUP} messages`);
  }
  
  // Now run the performance tests with Alice
  console.log("\nStarting performance tests with Alice...");
  
  // 1. Measure syncAllConversations time
  const syncStart = Date.now();
  const syncCount = await alice.conversations.syncAllConversations();
  const syncDuration = Date.now() - syncStart;
  
  console.log(`1. syncAllConversations for ${syncCount} groups took: ${syncDuration}ms`);
  
  // 2. Measure listConversations time
  const listStart = Date.now();
  const aliceGroupsList = await alice.conversations.list();
  const listDuration = Date.now() - listStart;
  
  console.log(`2. listConversations for ${aliceGroupsList.length} groups took: ${listDuration}ms`);
  
  assert(
    aliceGroupsList.length >= NUM_GROUPS,
    `Expected at least ${NUM_GROUPS} groups, found ${aliceGroupsList.length}`
  );
  
  // 3. Measure messages() time for each group in parallel
  console.log("3. Running messages() for each group in parallel...");
  
  // Start the timer for the total operation
  const totalFindStart = Date.now();
  
  const results = await Promise.all(
    aliceGroupsList.slice(0, NUM_GROUPS).map(async (group, i) => {
      const findStart = Date.now();
      
      try {
        const messagesWithMetrics = await conversationMessagesWithMetrics(alice.installationId, group.id);
        const metrics: FullMetrics = messagesWithMetrics.metrics;
        const messages = messagesWithMetrics.messages;
        
        return { groupIdx: i, messageCount: messages.length, metrics };
      } catch (e) {
        return { groupIdx: i, error: e };
      }
    })
  );
  
  const totalFindDuration = Date.now() - totalFindStart;
  
  // Calculate and display the total time
  console.log(`  - Total time for finding messages across all groups: ${totalFindDuration}ms`);
  
  // Collect and display results
  let success = true;
  
  for (const result of results) {
    if ('error' in result) {
      console.log(`  - Error in messages() for group ${result.groupIdx}: ${result.error}`);
      success = false;
      continue;
    }
    
    const { groupIdx, messageCount, metrics } = result;
    console.log(`  - Group ${groupIdx}: Found ${messageCount} messages in ${metrics.totalMs}ms`);
    console.log(`    - Bridge: ${metrics.bridgeMs}ms, JS Decode: ${metrics.jsDecodeMs}ms, Native: ${metrics.totalNativeDurationMs}ms, Encoding: ${metrics.encodingNativeDurationMs}ms`);
    const sum = metrics.bridgeMs + metrics.jsDecodeMs + metrics.totalNativeDurationMs + metrics.encodingNativeDurationMs;
    console.log(`    - Sum: ${sum}ms`);
    
    // Check that we found all messages
    assert(
      messageCount >= MESSAGES_PER_GROUP,
      `Expected at least ${MESSAGES_PER_GROUP} messages in group ${groupIdx}, found ${messageCount}`
    );
    
    // Check performance requirement
    if (metrics.totalMs > MAX_FIND_MESSAGES_TIME_MS) {
      console.log(`    WARNING: messages() took longer than ${MAX_FIND_MESSAGES_TIME_MS}ms`);
      success = false;
    }
  }
  
  // Add an assertion for the total time as well
  console.log(`Total time for all messages() operations: ${totalFindDuration}ms`);
  const averageTimePerGroup = totalFindDuration / NUM_GROUPS;
  console.log(`Average time per group: ${averageTimePerGroup.toFixed(2)}ms`);
  
  // Final assertion for the test
  assert(
    success,
    `One or more messages() operations took longer than ${MAX_FIND_MESSAGES_TIME_MS}ms`
  );
  
  console.log("Performance test completed successfully!");
  return true;
})
