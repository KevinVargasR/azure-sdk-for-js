// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type {
  ChatClientOptions,
  CreateChatThreadOptions,
  CreateChatThreadRequest,
} from "../../src/index.js";
import { ChatClient } from "../../src/index.js";
import type * as RestModel from "../../src/generated/src/models/index.js";
import { apiVersion } from "../../src/generated/src/models/parameters.js";
import { baseUri, generateToken } from "../public/utils/connectionUtils.js";
import type { CommunicationUserIdentifier } from "@azure/communication-common";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import {
  createChatClient,
  createChatClientWithSignaling,
  generateHttpClient,
  mockCreateThreadResult,
  mockThread,
  mockThreadItem,
  mockThreadItemWithRetentionPolicy,
} from "./utils/mockClient.js";
import { isNodeLike } from "@azure/core-util";
import { describe, it, assert, expect, vi } from "vitest";

const API_VERSION = apiVersion.mapper.defaultValue;

describe("[Mocked] ChatClient", async () => {
  let chatClient: ChatClient;
  const listener = (): void => {
    // Intentionally empty listener for testing purposes
  };

  it("can instantiate", async () => {
    new ChatClient(baseUri, new AzureCommunicationTokenCredential(generateToken()));
  });

  it("can instantiate with custom api version policy", async () => {
    const customizedVersion = `2021-03-07`;
    const mockHttpClient = generateHttpClient(201, mockCreateThreadResult);
    const options = { apiVersion: customizedVersion, httpClient: mockHttpClient };
    chatClient = new ChatClient(
      baseUri,
      new AzureCommunicationTokenCredential(generateToken()),
      options as ChatClientOptions,
    );

    const spy = vi.spyOn(mockHttpClient, "sendRequest");
    await chatClient.createChatThread({ topic: mockThread.topic });
    const request = spy.mock.calls[0][0];
    assert.equal(request.url, `${baseUri}/chat/threads?api-version=${customizedVersion}`);
  });

  it("makes successful create thread request", async () => {
    const mockHttpClient = generateHttpClient(201, mockCreateThreadResult);

    chatClient = createChatClient(mockHttpClient);
    const spy = vi.spyOn(mockHttpClient, "sendRequest");

    const sendRequest: CreateChatThreadRequest = {
      topic: mockThread.topic!,
    };

    const sendOptions = {
      metadata: mockThread.metadata,
    };

    const createThreadResult = await chatClient.createChatThread(sendRequest, sendOptions);

    expect(spy).toHaveBeenCalledOnce();
    assert.isDefined(createThreadResult.chatThread);
    assert.equal(createThreadResult.chatThread?.id, mockThread.id);
    assert.equal(createThreadResult.chatThread?.createdBy?.kind, "communicationUser");
    assert.deepEqual(
      (createThreadResult.chatThread?.createdBy as CommunicationUserIdentifier).communicationUserId,
      mockCreateThreadResult.chatThread?.createdByCommunicationIdentifier.communicationUser?.id,
    );
    assert.deepEqual(createThreadResult.chatThread?.metadata, mockThread.metadata);

    const request = spy.mock.calls[0][0];

    assert.equal(request.url, `${baseUri}/chat/threads?api-version=${API_VERSION}`);
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(request.body as string), {
      ...sendRequest,
      ...sendOptions,
    });
    assert.isNotEmpty(request.headers.get("repeatability-request-id"));
  });

  it("makes successful create thread request with retention policy", async function () {
    const mockHttpClient = generateHttpClient(201, {
      chatThread: mockThreadItemWithRetentionPolicy,
    });

    chatClient = createChatClient(mockHttpClient);
    const spy = vi.spyOn(mockHttpClient, "sendRequest");

    const sendRequest: CreateChatThreadRequest = {
      topic: mockThread.topic!,
    };

    const sendOptions: CreateChatThreadOptions = {
      retentionPolicy: { kind: "threadCreationDate", deleteThreadAfterDays: 90 },
    };

    const createThreadResult = await chatClient.createChatThread(sendRequest, sendOptions);

    expect(spy).toHaveBeenCalledOnce();
    assert.isDefined(createThreadResult.chatThread);
    assert.equal(createThreadResult.chatThread?.id, mockThreadItemWithRetentionPolicy.id);
    assert.equal(createThreadResult.chatThread?.createdBy?.kind, "communicationUser");
    assert.deepEqual(createThreadResult.chatThread?.retentionPolicy, sendOptions.retentionPolicy);

    const request = spy.mock.calls[0][0];
    assert.equal(request.url, `${baseUri}/chat/threads?api-version=${API_VERSION}`);
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(request.body as string), { ...sendRequest, ...sendOptions });
    assert.isNotEmpty(request.headers.get("repeatability-request-id"));
  });

  it("makes successful list threads request", async () => {
    const mockResponse: RestModel.ChatThreadsItemCollection = {
      value: [mockThreadItem, mockThreadItem],
    };

    const mockHttpClient = generateHttpClient(200, mockResponse);
    chatClient = createChatClient(mockHttpClient);
    const spy = vi.spyOn(mockHttpClient, "sendRequest");

    let count = 0;
    for await (const info of chatClient.listChatThreads()) {
      ++count;
      assert.isNotNull(info);
      assert.deepEqual(info, mockThreadItem);
    }

    expect(spy).toHaveBeenCalledOnce();
    assert.equal(count, mockResponse.value?.length);
    const request = spy.mock.calls[0][0];

    assert.equal(request.url, `${baseUri}/chat/threads?api-version=${API_VERSION}`);
    assert.equal(request.method, "GET");
  });

  it("makes successful list threads request by page", async () => {
    const mockResponse: RestModel.ChatThreadsItemCollection = {
      value: [mockThreadItem, mockThreadItem, mockThreadItem, mockThreadItem, mockThreadItem],
    };

    const mockHttpClient = generateHttpClient(200, mockResponse);
    chatClient = createChatClient(mockHttpClient);
    const spy = vi.spyOn(mockHttpClient, "sendRequest");

    const chatThreadsIterator = chatClient.listChatThreads({ maxPageSize: 2 });
    let count = 0;
    // loop over each page
    for await (const page of chatThreadsIterator.byPage()) {
      // loop over each item in the page
      for (const info of page) {
        ++count;
        assert.isNotNull(info);
        assert.deepEqual(info, mockThreadItem);
      }
    }

    expect(spy).toHaveBeenCalledOnce();
    assert.equal(count, mockResponse.value?.length);
    const request = spy.mock.calls[0][0];

    assert.equal(request.url, `${baseUri}/chat/threads?maxPageSize=2&api-version=${API_VERSION}`);
    assert.equal(request.method, "GET");
  });

  it("makes successful delete thread request", async () => {
    const mockHttpClient = generateHttpClient(204);
    chatClient = createChatClient(mockHttpClient);
    const spy = vi.spyOn(mockHttpClient, "sendRequest");

    await chatClient.deleteChatThread(mockThread.id!);

    expect(spy).toHaveBeenCalledOnce();
    const request = spy.mock.calls[0][0];
    assert.equal(
      request.url,
      `${baseUri}/chat/threads/${mockThread.id}?api-version=${API_VERSION}`,
    );
    assert.equal(request.method, "DELETE");
  });

  it("should throw an error to start real time notifications in node", async function (ctx) {
    if (!isNodeLike) {
      ctx.skip();
    }

    try {
      await chatClient.startRealtimeNotifications();
      throw new Error("Error is expected.");
    } catch (error) {
      expect(error).to.be.an.instanceof(Error);
      expect((error as Error).message).to.equal(
        "Realtime notifications are not supported in node js.",
      );
    }
  });

  it("should throw an error to stop real time notifications in node", async function (ctx) {
    if (!isNodeLike) {
      ctx.skip();
    }

    try {
      await chatClient.stopRealtimeNotifications();
      throw new Error("Error is expected.");
    } catch (error) {
      expect(error).to.be.an.instanceof(Error);
      expect((error as Error).message).to.equal(
        "Realtime notifications are not supported in node js.",
      );
    }
  });

  it("should throw an error to unsubscribe an event in node", function (ctx) {
    if (!isNodeLike) {
      ctx.skip();
    }

    try {
      chatClient.off("chatMessageReceived", listener);
      throw new Error("Error is expected.");
    } catch (error) {
      expect(error).to.be.an.instanceof(Error);
      expect((error as Error).message).to.equal(
        "Realtime notifications are only supported in the browser.",
      );
    }
  });

  it(
    "should throw an error to subscribe chatMessageReceived event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("chatMessageReceived", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe chatMessageEdited event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("chatMessageEdited", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe chatMessageDeleted event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("chatMessageDeleted", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe typingIndicatorReceived event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("typingIndicatorReceived", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe readReceiptReceived event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("readReceiptReceived", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe chatThreadCreated event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("chatThreadCreated", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe chatThreadDeleted event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("chatThreadDeleted", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe chatThreadPropertiesUpdated event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("chatThreadPropertiesUpdated", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe participantsAdded event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("participantsAdded", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it(
    "should throw an error to subscribe participantsRemoved event in node",
    { skip: !isNodeLike },
    () => {
      try {
        chatClient.on("participantsRemoved", listener);
        throw new Error("Error is expected.");
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal(
          "Realtime notifications are only supported in the browser.",
        );
      }
    },
  );

  it("enables polling with custom intervals and threads", async () => {
    // Arrange
    const mockHttpClient = generateHttpClient(200, { value: [mockThreadItem] });
    chatClient = createChatClientWithSignaling(mockHttpClient);

    // Act
    await chatClient.startRealtimeNotifications({
      threadsIds: [mockThreadItem.id],
      pollingOptions: {
        enabled: true,
        intervalInSec: 10,
        adaptivePolling: true,
      },
    });

    // Assert
    assert.isTrue((chatClient as any).isPollingEnable);
    assert.equal(
      (chatClient as any).pollingMode.get("default"),
      10000, // 10 seconds * 1000 = 10000 milliseconds
    );
    assert.equal(
      (chatClient as any).pollingMode.get("slow"),
      60000, // 60 seconds * 1000 = 60000 milliseconds
    );
    assert.equal(
      (chatClient as any).pollingMode.get("fast"),
      5000, // 5 seconds * 1000 = 5000 milliseconds
    );
    assert.isTrue((chatClient as any).adaptivePolling);
  });

  it("Enables polling with default intervals when options does not have intervals specified", async () => {
    // Arrange
    const mockHttpClient = generateHttpClient(200, { value: [mockThreadItem] });
    chatClient = createChatClientWithSignaling(mockHttpClient);

    // Act
    await chatClient.startRealtimeNotifications({
      threadsIds: [mockThreadItem.id], // Valid thread ID needed for polling
      pollingOptions: {
        enabled: true,
      },
    });

    // Assert
    assert.isTrue((chatClient as any).isPollingEnable);
    assert.equal(
      (chatClient as any).pollingMode.get("default"),
      20000, // 20 seconds * 1000 = 20000 milliseconds (default)
    );
    assert.equal(
      (chatClient as any).pollingMode.get("slow"),
      60000, // 60 seconds * 1000 = 60000 milliseconds (default)
    );
    assert.equal(
      (chatClient as any).pollingMode.get("fast"),
      5000, // 5 seconds * 1000 = 5000 milliseconds (default)
    );
  });

  it("does not enable polling if options is undefined", async () => {
    // Arrange
    const mockHttpClient = generateHttpClient(200, { value: [mockThreadItem] });
    chatClient = createChatClientWithSignaling(mockHttpClient);

    // Act
    await chatClient.startRealtimeNotifications();

    // Assert
    assert.isFalse((chatClient as any).isPollingEnable);
  });

  it("does not enable polling if threadIds is empty", async () => {
    // Arrange
    const mockHttpClient = generateHttpClient(200, { value: [mockThreadItem] });
    chatClient = createChatClientWithSignaling(mockHttpClient);

    // Act
    await chatClient.startRealtimeNotifications({
      threadsIds: [], // Empty array - should prevent polling
      pollingOptions: {
        enabled: true,
        adaptivePolling: true,
      },
    });

    // Assert
    assert.isFalse((chatClient as any).isPollingEnable);
  });

  it("does not enable polling if no matching threads found", async () => {
    // Arrange
    const mockHttpClient = generateHttpClient(200, { value: [mockThreadItem] });
    chatClient = createChatClientWithSignaling(mockHttpClient);

    // Act
    await chatClient.startRealtimeNotifications({
      threadsIds: ["invalid-thread-id"], // No matching threads
      pollingOptions: {
        enabled: false,
        adaptivePolling: true,
      },
    });

    // Assert
    assert.isFalse((chatClient as any).isPollingEnable);
  });

  it("switches to fast polling mode when adaptivePolling is enabled and no RTN activity", async () => {
    // Arrange
    const mockHttpClient = generateHttpClient(200, { value: [mockThreadItem] });
    chatClient = createChatClientWithSignaling(mockHttpClient);

    // Start with adaptivePolling enabled
    await chatClient.startRealtimeNotifications({
      threadsIds: [mockThreadItem.id],
      pollingOptions: {
        enabled: true,
        adaptivePolling: true,
      },
    });

    // Simulate last RTN activity was a long time ago (30 seconds ago, more than default 20s interval)
    (chatClient as any).lastTimeRTNWorked = new Date(Date.now() - 30000);

    // Simulate that real-time notifications are disconnected as well
    (chatClient as any).isRealtimeNotificationsConnected = false;

    // Act: Directly call the updatePollingMode logic that would happen in the poll function
    // This tests the adaptive polling logic without running the infinite polling loop
    const currentTime = Date.now();
    const lastRTNTime = (chatClient as any).lastTimeRTNWorked?.getTime() ?? 0;
    const timeSinceLastRTN = currentTime - lastRTNTime;
    const currentInterval = (chatClient as any).pollingMode.get((chatClient as any).currentPollingMode);

    // Verify the conditions that would trigger fast mode
    const shouldSwitchToFast =
      (chatClient as any).adaptivePolling &&
      ((timeSinceLastRTN > currentInterval && (chatClient as any).currentPollingMode === "default") ||
        (chatClient as any).isRealtimeNotificationsConnected === false);

    if (shouldSwitchToFast) {
      (chatClient as any).updatePollingMode("fast");
    }

    // Assert: Should have switched to fast mode
    assert.isTrue(shouldSwitchToFast, "Should meet conditions to switch to fast mode");
    assert.equal((chatClient as any).currentPollingMode, "fast");
  });
});
