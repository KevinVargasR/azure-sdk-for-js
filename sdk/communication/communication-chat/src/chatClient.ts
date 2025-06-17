// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type {
  ChatClientOptions,
  CreateChatThreadOptions,
  DeleteChatThreadOptions,
  ListChatThreadsOptions,
} from "./models/options.js";
import type {
  ChatEventId,
  ChatMessageDeletedEvent,
  ChatMessageEditedEvent,
  ChatMessageReceivedEvent,
  ChatThreadCreatedEvent,
  ChatThreadDeletedEvent,
  ChatThreadPropertiesUpdatedEvent,
  ParticipantsAddedEvent,
  ParticipantsRemovedEvent,
  ReadReceiptReceivedEvent,
  TypingIndicatorReceivedEvent,
} from "./models/events.js";
import type { ChatThreadItem, CreateChatThreadResult, ListPageSettings } from "./models/models.js";
import type { SignalingClient, SignalingClientOptions } from "@azure/communication-signaling";
import { ConnectionState } from "@azure/communication-signaling";
import {
  mapToChatParticipantRestModel,
  mapToCreateChatThreadOptionsRestModel,
  mapToCreateChatThreadResultSdkModel,
} from "./models/mappers.js";
import { ChatApiClient } from "./generated/src/index.js";
import { ChatThreadClient } from "./chatThreadClient.js";
import type { CommunicationTokenCredential } from "@azure/communication-common";
import type { CreateChatThreadRequest } from "./models/requests.js";
import { EventEmitter } from "events";
import type { InternalPipelineOptions } from "@azure/core-rest-pipeline";
import type { PagedAsyncIterableIterator } from "@azure/core-paging";
import { createCommunicationTokenCredentialPolicy } from "./credential/communicationTokenCredentialPolicy.js";
import { generateUuid } from "./models/uuid.js";
import { getSignalingClient } from "./signaling/signalingClient.js";
import { logger } from "./models/logger.js";
import { tracingClient } from "./generated/src/tracing.js";


/**
 * Polling modes
 */
export enum PollingMode {
  Default = "Default",
  Idle = "Idle",
  Emergency = "Emergency",
}
/**
 * Options for starting realtime notifications.
 */
export interface pollingOptions {
  /**
   * List of thread IDs to poll for messages.
   */
  pollingThreadsIDs?: string[];
  /**
   * Frequency to poll for messages.
  */
  pollingIntervals?: Partial<Record<PollingMode, AllowedPollingIntervals>>;
  /**
   * Whether to enable adaptive polling.
   */
  adaptativePolling?: boolean;

}

export type AllowedPollingIntervals = 5000 | 10000 | 20000 | 30000 | 60000 | 600000;

declare interface InternalChatClientOptions extends ChatClientOptions {
  signalingClientOptions?: SignalingClientOptions;
}

/**
 * The client to do chat operations
 */
export class ChatClient {
  private readonly tokenCredential: CommunicationTokenCredential;
  private readonly clientOptions: InternalChatClientOptions;
  private readonly client: ChatApiClient;
  private readonly signalingClient: SignalingClient | undefined = undefined;
  private readonly emitter = new EventEmitter();
  private isRealtimeNotificationsStarted: boolean = false;
  private messagesDetected: [string, string][] = [];
  /* Map to store threads with polling enabled.
  * The key is the thread ID and the value is the ChatThreadClient instance.*/
  private threadsWithPolling: Map<string, ChatThreadClient> = new Map();
  /**
   * Polling frequency in milliseconds.
   * Default is set to 20 seconds (20000 ms).
   * Can be set to one of the following values: 5000, 10000, 20000, 30000, 60000, 600000.
   */
  private pollingIntervals: Partial<Record<PollingMode, AllowedPollingIntervals>> = {
    [PollingMode.Default]: 20000,
    [PollingMode.Idle]: 600000,
    [PollingMode.Emergency]: 5000
  };
  private currentPollingMode: PollingMode = PollingMode.Default;
  /* Indicates if polling is active
  * If true, the client will poll for messages in the specified threads.*/
  private isPollingEnable: boolean = false;
  /*Flag to indicate if polling is running.
  * This is used to prevent multiple polling loops from running at the same time.*/
  private isPollingRunning: boolean = false;

  private adaptativePolling: boolean = false;

  private lastTimeRTNWorked: Date | null = null;
  //private currentPollingInterval: number = this.pollingIntervals[PollingMode.Default] || 20000; // Default polling frequency

  /**
   * Creates an instance of the ChatClient for a given resource and user.
   *
   * @param endpoint - The url of the Communication Services resource.
   * @param credential - The token credential. Use AzureCommunicationTokenCredential from \@azure/communication-common to create a credential.
   * @param options - Additional client options.
   */
  constructor(
    private readonly endpoint: string,
    credential: CommunicationTokenCredential,
    options: ChatClientOptions = {},
  ) {
    this.tokenCredential = credential;

    const internalPipelineOptions: InternalPipelineOptions = {
      ...options,
      ...{
        loggingOptions: {
          logger: logger.info,
        },
      },
    };

    this.client = new ChatApiClient(this.endpoint, {
      endpoint: this.endpoint,
      ...internalPipelineOptions,
    });

    const authPolicy = createCommunicationTokenCredentialPolicy(this.tokenCredential);
    this.client.pipeline.addPolicy(authPolicy);

    this.clientOptions = { ...options };
    this.clientOptions.signalingClientOptions = {
      ...this.clientOptions.signalingClientOptions,
      resourceEndpoint: this.endpoint,
      gatewayApiVersion: this.client.apiVersion,
    };

    this.signalingClient = getSignalingClient(
      credential,
      logger,
      this.clientOptions.signalingClientOptions,
    );
  }

  /**
   * Returns ChatThreadClient with the specific thread id.
   * @param threadId - Thread ID for the ChatThreadClient
   */
  public getChatThreadClient(threadId: string): ChatThreadClient {
    return new ChatThreadClient(this.endpoint, threadId, this.tokenCredential, this.clientOptions);
  }

  /**
   * Creates a chat thread.
   * Returns thread client with the id of the created thread.
   * @param request - Request for creating a chat thread.
   * @param options - Operation options.
   */
  public async createChatThread(
    request: CreateChatThreadRequest,
    options: CreateChatThreadOptions = {},
  ): Promise<CreateChatThreadResult> {
    return tracingClient.withSpan(
      "ChatClient-CreateChatThread",
      options,
      async (updatedOptions) => {
        // We generate an UUID if the user does not provide an idempotencyToken value
        updatedOptions.idempotencyToken = updatedOptions.idempotencyToken ?? generateUuid();
        const updatedRestModelOptions = mapToCreateChatThreadOptionsRestModel(updatedOptions);

        const result = await this.client.chat.createChatThread(
          {
            topic: request.topic,
            participants: options.participants?.map((participant) =>
              mapToChatParticipantRestModel(participant),
            ),
          },
          updatedRestModelOptions,
        );
        return mapToCreateChatThreadResultSdkModel(result);
      },
    );
  }

  private async *listChatThreadsPage(
    continuationState: ListPageSettings,
    options: ListChatThreadsOptions = {},
  ): AsyncIterableIterator<ChatThreadItem[]> {
    if (!continuationState.continuationToken) {
      const currentSetResponse = await this.client.chat.listChatThreads(options);
      continuationState.continuationToken = currentSetResponse.nextLink;
      if (currentSetResponse.value) {
        yield currentSetResponse.value;
      }
    }

    while (continuationState.continuationToken) {
      const currentSetResponse = await this.client.chat.listChatThreadsNext(
        continuationState.continuationToken,
        options,
      );
      continuationState.continuationToken = currentSetResponse.nextLink;
      if (currentSetResponse.value) {
        yield currentSetResponse.value;
      } else {
        break;
      }
    }
  }

  private async *listChatThreadsAll(
    options: ListChatThreadsOptions,
  ): AsyncIterableIterator<ChatThreadItem> {
    for await (const page of this.listChatThreadsPage({}, options)) {
      yield* page;
    }
  }

  /**
   * Gets the list of chat threads of a user.
   * @param options - List chat threads options.
   */
  public listChatThreads(
    options: ListChatThreadsOptions = {},
  ): PagedAsyncIterableIterator<ChatThreadItem> {
    const { span, updatedOptions } = tracingClient.startSpan("ChatClient-ListChatThreads", options);
    try {
      const iter = this.listChatThreadsAll(updatedOptions);
      return {
        next() {
          return iter.next();
        },
        [Symbol.asyncIterator]() {
          return this;
        },
        byPage: (settings: ListPageSettings = {}) => {
          return this.listChatThreadsPage(settings, updatedOptions);
        },
      };
    } catch (e: any) {
      span.setStatus({
        error: e,
        status: "error",
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Deletes a chat thread.
   * @param threadId - The ID of the thread to delete.
   * @param options -  Operation options.
   */
  public async deleteChatThread(
    threadId: string,
    options: DeleteChatThreadOptions = {},
  ): Promise<void> {
    return tracingClient.withSpan(
      "ChatClient-DeleteChatThread",
      options,
      async (updatedOptions) => {
        await this.client.chat.deleteChatThread(threadId, updatedOptions);
      },
    );
  }

  /**
   * Start receiving realtime notifications.
   * Call this function before subscribing to any event.
   * To add polling for messages as a backup mechanism, its necessary to add options parameter with the pollingThreadsIDs array.
   * @param options - Options for starting realtime notifications.
   */
  public async startRealtimeNotifications(options?: pollingOptions): Promise<void> {
    if (this.signalingClient === undefined) {
      throw new Error("Realtime notifications are not supported in node js.");
    }

    if (this.isRealtimeNotificationsStarted) {
      return;
    }

    this.isRealtimeNotificationsStarted = true;
    await this.signalingClient.start();
    this.subscribeToSignalingEvents();
    /**
     * If options are provided, we will set up polling for the specified threads.
     * The threadsWithPolling map will be populated with the thread IDs and their corresponding ChatThreadClient instances.
     * The startingPollingFrequency will determine the initial polling frequency.
     * The dynamicPolling flag will determine if the polling frequency should change based on the last time RTN worked.
     */
    if (options !== undefined) {
      const { pollingThreadsIDs, pollingIntervals, adaptativePolling } = options;
      const allChatThreads = this.listChatThreads();
      if (pollingThreadsIDs !== undefined && pollingThreadsIDs.length > 0) {
        for await (const thread of allChatThreads) {
          if (pollingThreadsIDs.includes(thread.id)) {
            const chatThreadClient = this.getChatThreadClient(thread.id);
            this.threadsWithPolling.set(thread.id, chatThreadClient);
          }
        }
      }
      else {
        const chatThreadClient = this.listChatThreads();
        for await (const thread of chatThreadClient) {
          this.threadsWithPolling.set(thread.id, this.getChatThreadClient(thread.id));
        }
      }
      // Set the polling intervals based on the provided options
      if (pollingIntervals !== undefined) {
        const allowedPollingValues: AllowedPollingIntervals[] = [5000, 10000, 20000, 30000, 60000, 600000];
        if (pollingIntervals.Default !== undefined && allowedPollingValues.includes(pollingIntervals.Default)) {
          this.pollingIntervals[PollingMode.Default] = pollingIntervals.Default;
        } else {
          console.warn(
            `Invalid polling interval for Default mode. Using default value of 20000 ms.`,
          );
          this.pollingIntervals[PollingMode.Default] = 20000; // Default polling frequency
        }
        if (pollingIntervals.Idle !== undefined && allowedPollingValues.includes(pollingIntervals.Idle)) {
          this.pollingIntervals[PollingMode.Idle] = pollingIntervals.Idle;
        } else {
          console.warn(
            `Invalid polling interval for Idle mode. Using default value of 600000 ms.`,
          );
          this.pollingIntervals[PollingMode.Idle] = 600000; // Default idle polling frequency
        }
        if (pollingIntervals.Emergency !== undefined && allowedPollingValues.includes(pollingIntervals.Emergency)) {
          this.pollingIntervals[PollingMode.Emergency] = pollingIntervals.Emergency;
        } else {
          console.warn(
            `Invalid polling interval for Emergency mode. Using default value of 5000 ms.`,
          );
          this.pollingIntervals[PollingMode.Emergency] = 5000; // Default emergency polling frequency
        }
      }
      // Enable adaptative polling if specified
      if (adaptativePolling) {
        this.adaptativePolling = adaptativePolling;
      }
      this.startPolling();
    }
  }

  /**
   * Stop receiving realtime notifications.
   * This function would unsubscribe to all events.
   * This function will also stop polling for messages if it was started.
   */
  public async stopRealtimeNotifications(): Promise<void> {
    if (this.signalingClient === undefined) {
      throw new Error("Realtime notifications are not supported in node js.");
    }

    this.isRealtimeNotificationsStarted = false;
    await this.signalingClient.stop();
    this.emitter.removeAllListeners();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.stopPolling();
  }

  /**
  * Update the polling frequency value for a specific key.
  * @param frequencyKey - The key for the polling frequency to update.
  * @param value - The new value for the polling frequency.
  * @throws Error if the value is not a positive number. 
  */
  private updatePollingMode(pollingMode: PollingMode): void {
    this.currentPollingMode = pollingMode;
    console.log("Polling with frequency:", this.pollingIntervals[this.currentPollingMode]);
  }

  /**
   * Update the list of chat threads to poll for messages.
   * This will clear the existing threadsWithPolling map and populate it with the new chat threads.
   * @param newChatThreads - List of thread IDs to poll for messages.
   */
  public async updateChatThreadsList(newChatThreads: string[]): Promise<void> {
    if (newChatThreads.length === 0) {
      throw new Error("Polling cannot have an empty list.");
    } else {
      this.threadsWithPolling.clear();
      for (const threadId of newChatThreads) {
        const chatThreadClient = this.getChatThreadClient(threadId);
        this.threadsWithPolling.set(threadId, chatThreadClient);
      }
    }
  }
  /**
   * Stop polling for messages.
   * This will set isPollingEnable to false, stopping the polling loop.
   */
  public stopPollingForMessages(): void {
    this.stopPolling();
  }

  /** 
   * Resume polling for messages.
   * This will set isPollingEnable to true, resuming the polling loop.
   * If dynamic polling is enabled, it will update the polling frequency to Default.
  */
  public resumePollingForMessages(): void {
    if (!this.isPollingEnable) {
      this.startPolling();
    }
  }

  /**
   * Subscribe function for chatMessageReceived.
   * The initial sender will also receive this event.
   * You need to call startRealtimeNotifications before subscribing to any event.
   * @param event - The ChatMessageReceivedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "chatMessageReceived", listener: (e: ChatMessageReceivedEvent) => void): void;

  /**
   * Subscribe function for chatMessageEdited.
   * The initial sender will also receive this event.
   * @param event - The ChatMessageEditedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "chatMessageEdited", listener: (e: ChatMessageEditedEvent) => void): void;

  /**
   * Subscribe function for chatMessageDeleted.
   * The initial sender will also receive this event.
   * @param event - The ChatMessageDeletedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "chatMessageDeleted", listener: (e: ChatMessageDeletedEvent) => void): void;

  /**
   * Subscribe function for typingIndicatorReceived.
   * The initial sender will also receive this event.
   * @param event - The TypingIndicatorReceivedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(
    event: "typingIndicatorReceived",
    listener: (e: TypingIndicatorReceivedEvent) => void,
  ): void;

  /**
   * Subscribe function for readReceiptReceived.
   * @param event - The ReadReceiptReceivedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "readReceiptReceived", listener: (e: ReadReceiptReceivedEvent) => void): void;

  /**
   * Subscribe function for chatThreadCreated.
   * @param event - The ChatThreadCreatedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "chatThreadCreated", listener: (e: ChatThreadCreatedEvent) => void): void;

  /**
   * Subscribe function for chatThreadDeleted.
   * @param event - The ChatThreadDeletedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "chatThreadDeleted", listener: (e: ChatThreadDeletedEvent) => void): void;

  /**
   * Subscribe function for chatThreadPropertiesUpdated.
   * @param event - The ChatThreadPropertiesUpdatedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(
    event: "chatThreadPropertiesUpdated",
    listener: (e: ChatThreadPropertiesUpdatedEvent) => void,
  ): void;

  /**
   * Subscribe function for participantsAdded.
   * @param event - The ParticipantsAddedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "participantsAdded", listener: (e: ParticipantsAddedEvent) => void): void;

  /**
   * Subscribe function for participantsRemoved.
   * @param event - The ParticipantsRemovedEvent.
   * @param listener - The listener to handle the event.
   */
  public on(event: "participantsRemoved", listener: (e: ParticipantsRemovedEvent) => void): void;

  /**
   * Subscribe function for realTimeNotificationConnected.
   * @param event - The realTimeNotificationConnected Event
   * @param listener - The listener to handle the event.
   */
  public on(event: "realTimeNotificationConnected", listener: () => void): void;

  /**
   * Subscribe function for realTimeNotificationDisconnected.
   * @param event - The realTimeNotificationDisconnected Event
   * @param listener - The listener to handle the event.
   */
  public on(event: "realTimeNotificationDisconnected", listener: () => void): void;

  public on(event: ChatEventId, listener: (e?: any) => void): void {
    if (this.signalingClient === undefined) {
      throw new Error("Realtime notifications are only supported in the browser.");
    }
    if (
      !this.isRealtimeNotificationsStarted &&
      event !== "realTimeNotificationConnected" &&
      event !== "realTimeNotificationDisconnected"
    ) {
      throw new Error(
        "You must call startRealtimeNotifications before you can subscribe to events.",
      );
    }

    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from chatMessageReceived.
   * @param event - The ChatMessageReceivedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "chatMessageReceived", listener: (e: ChatMessageReceivedEvent) => void): void;

  /**
   * Unsubscribe from chatMessageEdited.
   * @param event - The ChatMessageEditedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "chatMessageEdited", listener: (e: ChatMessageEditedEvent) => void): void;

  /**
   * Unsubscribe from chatMessageDeleted.
   * @param event - The ChatMessageDeletedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "chatMessageDeleted", listener: (e: ChatMessageDeletedEvent) => void): void;

  /**
   * Unsubscribe from typingIndicatorReceived.
   * @param event - The TypingIndicatorReceivedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(
    event: "typingIndicatorReceived",
    listener: (e: TypingIndicatorReceivedEvent) => void,
  ): void;

  /**
   * Unsubscribe from readReceiptReceived.
   * @param event - The ReadReceiptReceivedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "readReceiptReceived", listener: (e: ReadReceiptReceivedEvent) => void): void;

  /**
   *  Unsubscribe from chatThreadCreated.
   * @param event - The ChatThreadCreatedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "chatThreadCreated", listener: (e: ChatThreadCreatedEvent) => void): void;

  /**
   *  Unsubscribe from chatThreadDeleted.
   * @param event - The ChatThreadDeletedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "chatThreadDeleted", listener: (e: ChatThreadDeletedEvent) => void): void;

  /**
   * Unsubscribe from chatThreadPropertiesUpdated.
   * @param event - The ChatThreadPropertiesUpdatedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(
    event: "chatThreadPropertiesUpdated",
    listener: (e: ChatThreadPropertiesUpdatedEvent) => void,
  ): void;

  /**
   * Unsubscribe from participantsAdded.
   * @param event - The ParticipantsAddedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "participantsAdded", listener: (e: ParticipantsAddedEvent) => void): void;

  /**
   * Unsubscribe from participantsRemoved.
   * @param event - The ParticipantsRemovedEvent.
   * @param listener - The listener to handle the event.
   */
  public off(event: "participantsRemoved", listener: (e: ParticipantsRemovedEvent) => void): void;

  public off(event: ChatEventId, listener: (e: any) => void): void {
    if (this.signalingClient === undefined) {
      throw new Error("Realtime notifications are only supported in the browser.");
    }

    this.emitter.removeListener(event, listener);
  }

  private subscribeToSignalingEvents(): void {
    if (this.signalingClient === undefined) {
      throw new Error("Realtime notifications are only supported in the browser.");
    }

    this.signalingClient.on("connectionChanged", (payload) => {
      if (payload === ConnectionState.Connected) {
        this.emitter.emit("realTimeNotificationConnected");
        if (this.adaptativePolling) {
          this.updatePollingMode(PollingMode.Default);   //function to return polling to default mode
        }
      } else if (payload === ConnectionState.Disconnected) {
        this.emitter.emit("realTimeNotificationDisconnected");
        if (this.adaptativePolling) {
          this.updatePollingMode(PollingMode.Emergency); //function to change polling to emergency mode
        }
      }
    });

    this.signalingClient.on("chatMessageReceived", (payload) => {
      this.lastTimeRTNWorked = new Date();

      if (this.adaptativePolling && this.currentPollingMode !== PollingMode.Default) {
        this.currentPollingMode = PollingMode.Default;
      }
      //this.emitter.emit("chatMessageReceived", payload); //this line is commented out to simulate unstable conditions of RTN.
      if (Math.random() < 0.5) {
        this.emitter.emit("chatMessageReceived", payload);
        if (this.threadsWithPolling.has(payload.threadId)) {
          // If the message is already detected, it will not emit the event again.
          this.messagesDetected.push([payload.id, payload.threadId]);
          console.log("Message Stored:", payload.id);
        }
      } else {
        console.log("Message Not Emitted:", payload.id);
      }
      /* * The following code is commented out to simulate unstable conditions of RTN. 
      *If the thread ID is in the threadsWithPolling map, we will add the message id and thread id to the messagesDetected array.*/
      /*if (this.threadsWithPolling.has(payload.threadId)) {
        // If the message is already detected, we will not emit the event again.
        this.messagesDetected.push([payload.id, payload.threadId]);
        console.log("Message Stored:", payload.id);
      }*/
    });

    this.signalingClient.on("chatMessageEdited", (payload) => {
      this.emitter.emit("chatMessageEdited", payload);
    });

    this.signalingClient.on("chatMessageDeleted", (payload) => {
      this.emitter.emit("chatMessageDeleted", payload);
    });

    this.signalingClient.on("typingIndicatorReceived", (payload) => {
      this.emitter.emit("typingIndicatorReceived", payload);
    });

    this.signalingClient.on("readReceiptReceived", (payload) => {
      this.emitter.emit("readReceiptReceived", payload);
    });

    this.signalingClient.on("chatThreadCreated", (payload) => {
      this.emitter.emit("chatThreadCreated", payload);
    });

    this.signalingClient.on("chatThreadDeleted", (payload) => {
      this.emitter.emit("chatThreadDeleted", payload);
    });

    this.signalingClient.on("chatThreadPropertiesUpdated", (payload) => {
      this.emitter.emit("chatThreadPropertiesUpdated", payload);
    });

    this.signalingClient.on("participantsAdded", (payload) => {
      this.emitter.emit("participantsAdded", payload);
    });

    this.signalingClient.on("participantsRemoved", (payload) => {
      this.emitter.emit("participantsRemoved", payload);
    });
  }

  /**
 * Start polling for messages in specified threads.
 * @param threadsWithPolling - List of thread IDs to poll for messages.
 * @param pollingFrequency - Frequency (in milliseconds) to poll for messages.
 */
  private async startPolling(): Promise<void> {
    if (this.isPollingRunning) return;
    this.isPollingEnable = true;
    this.isPollingRunning = true;
    const waitTime = this.pollingIntervals[this.currentPollingMode] ?? 20000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    const poll = async (): Promise<void> => {
      if (!this.isPollingEnable) {
        this.isPollingRunning = false;
        return;
      }
      try {
        /* Check the last time RTN worked 
        * and update the polling frequency accordingly.
        */
        if (
          this.adaptativePolling &&
          Date.now() - (this.lastTimeRTNWorked?.getTime() ?? 0) >
          (this.pollingIntervals[this.currentPollingMode] ?? 20000) && this.currentPollingMode === PollingMode.Default
          && this.lastTimeRTNWorked !== null
        ) {
          if (this.messagesDetected.length > 0) {
            this.currentPollingMode = PollingMode.Emergency;
          } else {
            this.currentPollingMode = PollingMode.Idle;
          }
        }
        //this.messagesDetected = [];
        /* * Iterate through the threadsWithPolling map and poll for messages in each thread.*/
        for (const [key, chatThread] of this.threadsWithPolling) {
          const returnTime = this.pollingIntervals[this.currentPollingMode] ?? 20000;
          const startTime = new Date(Date.now() - returnTime);
          try {
            const messages = chatThread.listMessages({ startTime: startTime });
            const messagesArray = [];
            for await (const message of messages) {
              messagesArray.push(message);
            }
            for (let i = messagesArray.length - 1; i >= 0; i--) {
              const message = messagesArray[i];
              const exists = this.messagesDetected.some(
                ([id, threadId]) => id === message.id && threadId === key,
              );
              /* If the message is not already detected, emit the event and add it to messagesDetected array.*/
              if (!exists) {
                this.emitter.emit("chatMessageReceived", {
                  id: message.id,
                  threadId: key,
                  sender: message.sender,
                  senderDisplayName: message.senderDisplayName,
                  createdOn: message.createdOn,
                });
                this.messagesDetected.push([message.id, key]);
              }
            }
          } catch (error) {
            logger.error("Error in polling messages: ", error);
          }
        }
      } catch (err) {
        logger.error("Polling loop error: ", err);
      }

      // Schedule the next poll only after this one finishes
      if (this.isPollingEnable) {
        console.log("Polling with frequency:", this.pollingIntervals[this.currentPollingMode]);
        setTimeout(poll, this.pollingIntervals[this.currentPollingMode]);
      } else {
        this.isPollingRunning = false;
      }
    };

    poll();
  }
  /** 
   * Stop polling for messages.
   * This will set isPollingEnable to false, stopping the polling loop.
  */
  private stopPolling(): void {
    this.isPollingEnable = false;
  }

}
