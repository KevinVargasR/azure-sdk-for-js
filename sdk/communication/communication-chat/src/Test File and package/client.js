// <Create a chat client>
import { ChatClient, ChatThreadClient, PollingMode } from '@azure/communication-chat';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';

let endpointUrl = 'https://azurecommunicationservices.communication.azure.com';
let userAccessToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkRCQTFENTczNEY1MzM4QkRENjRGNjA4NjE2QTQ5NzFCOTEwNjU5QjAiLCJ4NXQiOiIyNkhWYzA5VE9MM1dUMkNHRnFTWEc1RUdXYkEiLCJ0eXAiOiJKV1QifQ.eyJza3lwZWlkIjoiYWNzOmZhYzQ2MDdkLWQyZDAtNDBlNS04NGRmLTZmMzJlYmQxMjUxYV8wMDAwMDAyNy00N2EzLWVjMGQtOTgwNi0xMTNhMGQwMGYzZWQiLCJzY3AiOjE3OTIsImNzaSI6IjE3NTE5MTM2OTkiLCJleHAiOjE3NTIwMDAwOTksInJnbiI6ImFtZXIiLCJhY3NTY29wZSI6ImNoYXQiLCJyZXNvdXJjZUlkIjoiZmFjNDYwN2QtZDJkMC00MGU1LTg0ZGYtNmYzMmViZDEyNTFhIiwicmVzb3VyY2VMb2NhdGlvbiI6InVuaXRlZHN0YXRlcyIsImlhdCI6MTc1MTkxMzY5OX0.hxolDiE9HWs_Wtfi9ZyOmoAjIs2C6j7yhDvn0Us-MT2EHFx6P_fXVxVIpemNvEAfTpmGE-FRDnNVBYwMuTFKl4_KOMBnDsDXceRkfm7GQMLf4J7xwYSNHaEhsbmZl_nFATi_wKohkJan78FtiSg14lhrSPEE_xXBiyTFbbZylUyNyVYB7KIxCzGFxX3UmM-wRf-9DgcQZxD5JbqgGmX9wLLePGaudLHE1W-KiIiZ9gSRPm38kmtnxFZ-v1csAPutCHBXTSrnlYt84P-o4rNTd8ynvYwc2J_BBXcZ-QHydZwatvCcVm5NRZFkaMobJ3CoTK0a6Xhki1KsIILl9fsCHw";
let chatClient = new ChatClient(endpointUrl, new AzureCommunicationTokenCredential(userAccessToken));
console.log('Azure Communication Chat client created!');

// Existing thread ID (replace with your actual thread ID)
const existingThreadId = '19:acsV1_aHkYGxwAHQ4M2u5JJwS94zNHne0xclFKmf6jMm1yLxY1@thread.v2';

// Function to get or create a chat thread
async function getOrCreateChatThread() {
  if (existingThreadId) {
    console.log(`Using existing thread ID: ${existingThreadId}`);
    return existingThreadId;
  }

  // Create a new chat thread if no existing thread ID is provided
  const createChatThreadRequest = {
    topic: "Calling Application"
  };
  const createChatThreadOptions = {
    participants: [
      {
        id: { communicationUserId: '8:acs:fac4607d-d2d0-40e5-84df-6f32ebd1251a_00000027-47a3-ec0d-9806-113a0d00f3ed' },
        displayName: 'Mario Hugo'
      }
    ]
  };
  const createChatThreadResult = await chatClient.createChatThread(
    createChatThreadRequest,
    createChatThreadOptions
  );
  const threadId = createChatThreadResult.chatThread.id;
  console.log(`New thread created with ID: ${threadId}`);
  return threadId;
}

getOrCreateChatThread().then(async threadId => {
  console.log(`Thread in use: ${threadId}`);
  /*
      // <Get a chat thread client>
      let chatThreadClient = chatClient.getChatThreadClient(threadId);
      console.log(`Chat Thread client for threadId: ${threadId}`);
  
      // <List all chat threads>
      const threads = chatClient.listChatThreads();
      for await (const thread of threads) {
          console.log(`Chat Thread item: ${thread.id}`);
      }
  
      // <Receive chat messages from a chat thread>
      chatClient.startRealtimeNotifications();
      chatClient.on("chatMessageReceived", async (e) => {
          console.log("Notification chatMessageReceived!");
      });*/
  /*
      // <Send a message to a chat thread>
      const sendMessageRequest = {
          content: 'Hello Geeta! Can you share the deck for the conference?'
      };
      let sendMessageOptions = {
          senderDisplayName: 'Jack',
          type: 'text'
      };
  
      const sendChatMessageResult = await chatThreadClient.sendMessage(sendMessageRequest, sendMessageOptions);
      const messageId = sendChatMessageResult.id;
  
      // <List messages in a chat thread>
      const messages = chatThreadClient.listMessages();
      for await (const message of messages) {
          console.log(`Chat Thread message id: ${message.id}`);
      }*/
});
/*
// Function to send a message every 30 seconds
async function sendMessagePeriodically(chatThreadClient) {
    let counter = 1; // Counter to differentiate messages
    setInterval(async () => {
        const sendMessageRequest = {
            content: `Periodic message #${counter}`
        };
        const sendMessageOptions = {
            senderDisplayName: 'Periodic Sender',
            type: 'text'
        };

        try {
            const sendChatMessageResult = await chatThreadClient.sendMessage(sendMessageRequest, sendMessageOptions);
            console.log(`Message sent with ID: ${sendChatMessageResult.id}`);
            counter++;
            const sendChatMessageResult2 = await chatThreadClient.sendMessage(sendMessageRequest, sendMessageOptions);
            console.log(`Mensaje enviado con ID: ${sendChatMessageResult2.id}`);
            counter++;
        } catch (error) {
            console.error('Error sending periodic message:', error);
        }
    }, 10000); // 30 seconds interval
}*/

async function sendMessagePeriodicallyToAllThreads(chatClient, threadIds) {
  let counter = 1;
  setInterval(async () => {
    for (const threadId of threadIds) {
      try {
        const chatThreadClient = chatClient.getChatThreadClient(threadId);
        const sendMessageRequest = {
          content: `Periodic message #${counter} to thread ${threadId}`
        };
        const sendMessageOptions = {
          senderDisplayName: 'Periodic Sender',
          type: 'text'
        };
        const sendChatMessageResult = await chatThreadClient.sendMessage(sendMessageRequest, sendMessageOptions);
        console.log(`Message sent to thread ${threadId} with ID: ${sendChatMessageResult.id}`);
      } catch (error) {
        console.error(`Error sending message to thread ${threadId}:`, error);
      }
    }
    counter++;
  }, 10000); // 10 seconds interval
}
async function listChatThreads(chatClient) {
  const threadIds = [];
  const threads = chatClient.listChatThreads();
  for await (const thread of threads) {
    console.log(`Chat Thread item: ${thread.id}`);
    threadIds.push(thread.id);
  }
  return threadIds;
}

async function sendMessageToAllThreads(chatClient, threadIds) {
  let counter = 1;
  for (const threadId of threadIds) {
    try {
      const chatThreadClient = chatClient.getChatThreadClient(threadId);
      const sendMessageRequest = {
        content: `Single message #${counter} to thread ${threadId}`
      };
      const sendMessageOptions = {
        senderDisplayName: 'Single Sender',
        type: 'text'
      };
      const sendChatMessageResult = await chatThreadClient.sendMessage(sendMessageRequest, sendMessageOptions);
      console.log(`Message sent to thread ${threadId} with ID: ${sendChatMessageResult.id}`);
    } catch (error) {
      console.error(`Error sending message to thread ${threadId}:`, error);
    }
    counter++;
  }
}

getOrCreateChatThread().then(async threadId => {
  console.log(`Thread in use: ${threadId}`);

  // <Get a chat thread client>
  let chatThreadClient = chatClient.getChatThreadClient(threadId);
  console.log(`Chat Thread client for threadId: ${threadId}`);

  // <List all chat threads>
  /*const threads = chatClient.listChatThreads();
  for await (const thread of threads) {
      console.log(`Chat Thread item: ${thread.id}`);
  }*/

  const threadsMessage = [
    "19:acsV1_aHkYGxwAHQ4M2u5JJwS94zNHne0xclFKmf6jMm1yLxY1@thread.v2", "19:acsV1_wRHXTnJ0denSPZaPy83iSWQsQlHoVNmVBegqkgxNc481@thread.v2"//,
    //"19:acsV1_YHwwmQeaFige0Usu2oYNNt4jUzSmHoAvhb3VbzB6twU1@thread.v2"//,"19:acsV1_rPxtSkFJbmLrVsg7G7-6GsEuQhQNgX-cWvnovcd58Cw1@thread.v2",
    //"19:acsV1_YLsxuZbt-S6M5RFbngpEJWMVxYGfn7Kfl9CXt0qwzGw1@thread.v2"*/
  ];



  /**
   * Functions called to test the chat client functionality
   * Uncomment the functions you want to test.
   * Note: Some functions may require an existing thread ID or may create new threads.
   * If you want to test sending messages periodically, make sure to comment out the other functions
   * to avoid conflicts.
   */

  const options = {
    pollingThreadsIDs: [
      "19:acsV1_aHkYGxwAHQ4M2u5JJwS94zNHne0xclFKmf6jMm1yLxY1@thread.v2",
      "19:acsV1_wRHXTnJ0denSPZaPy83iSWQsQlHoVNmVBegqkgxNc481@thread.v2"
    ],
    pollingIntervals: {
      [PollingMode.Emergency]: 8,
      [PollingMode.Default]: 15, // Optional: override default polling interval (ms)
      [PollingMode.Idle]: 43, // Optional: override idle polling interval (ms)
    },
    adaptativePolling: true,        // Optional: override idle polling interval (ms)
  };

  // chatClient.startRealtimeNotifications({});
  chatClient.startRealtimeNotifications(options);
  // chatClient.startRealtimeNotifications();
  chatClient.on("chatMessageReceived", async (e) => {
    console.log("Notification chatMessageReceived!");
    console.log(`Message ID: ${e.id}`);
  });

  // Start sending periodic messages to the specified thread
  //sendMessagePeriodically(chatThreadClient);

  //Create multiple chat threads and get its IDs
  //await createMultipleChatThreads(chatClient, 4);
  /*listChatThreads(chatClient).then(threadIds => {
  console.log("All thread IDs:", threadIds);
  });*/

  // Send a single message to all threads
  //sendMessageToAllThreads(chatClient, threadsMessage);
  //sendMessagePeriodicallyToAllThreads(chatClient, threadsMessage);

});

// Function to manually send messages from a web page
window.testClientJs = function () {
  sendMessageToAllThreads(chatClient, ["19:acsV1_aHkYGxwAHQ4M2u5JJwS94zNHne0xclFKmf6jMm1yLxY1@thread.v2", "19:acsV1_wRHXTnJ0denSPZaPy83iSWQsQlHoVNmVBegqkgxNc481@thread.v2"]);
};

window.emitConnectionChange = function (state) {
  // Simulate the payload as would be received from signalingClient
  if (state === "connected" || state === "disconnected") {
    // Emit the original connectionChanged event
    chatClient.emitter.emit("connectionChanged", { state });
    console.log(`Emitted connectionChanged: ${state}`);

    // Simulate the logic in subscribeToSignalingEvents
    if (state === "connected") {
      chatClient.emitter.emit("realTimeNotificationConnected");
      if (chatClient.adaptativePolling && chatClient.isPollingEnable && typeof chatClient.updatePollingMode === "function") {
        console.log("Polling mode set to Default due to connection.");
      }
    } else if (state === "disconnected") {
      chatClient.emitter.emit("realTimeNotificationDisconnected");
      if (chatClient.adaptativePolling && chatClient.isPollingEnable && typeof chatClient.updatePollingMode === "function") {
        console.log("Polling mode set to Emergency due to disconnection.");
      }
    }
  } else {
    console.warn("Invalid state. Use 'connected' or 'disconnected'.");
  }
};
