/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is regenerated.
 */

import {
  env,
  Recorder,
  RecorderStartOptions,
  isPlaybackMode,
} from "@azure-tools/test-recorder";
import { createTestCredential } from "@azure-tools/test-credential";
import { describe, it, assert, beforeEach, afterEach } from "vitest";
import { ManagedServiceIdentityClient } from "../src/managedServiceIdentityClient.js";

const replaceableVariables: Record<string, string> = {
  SUBSCRIPTION_ID: "88888888-8888-8888-8888-888888888888"
};

const recorderOptions: RecorderStartOptions = {
  envSetupForPlayback: replaceableVariables,
  removeCentralSanitizers: [
    "AZSDK3493", // .name in the body is not a secret and is listed below in the beforeEach section
    "AZSDK3430", // .id in the body is not a secret and is listed below in the beforeEach section
  ],
};

export const testPollingOptions = {
  updateIntervalInMs: isPlaybackMode() ? 0 : undefined,
};

describe("msi test", () => {
  let recorder: Recorder;
  let subscriptionId: string;
  let client: ManagedServiceIdentityClient;

  beforeEach(async (ctx) => {
    recorder = new Recorder(ctx);
    await recorder.start(recorderOptions);
    subscriptionId = env.SUBSCRIPTION_ID || '';
    // This is an example of how the environment variables are used
    const credential = createTestCredential();
    client = new ManagedServiceIdentityClient(credential, subscriptionId, recorder.configureClientOptions({}));
  });

  afterEach(async () => {
    await recorder.stop();
  });

  it("operations list test", async function () {
    const resArray = new Array();
    for await (let item of client.operations.list()) {
      resArray.push(item);
    }
    assert.notEqual(resArray.length, 0);
  });

})
