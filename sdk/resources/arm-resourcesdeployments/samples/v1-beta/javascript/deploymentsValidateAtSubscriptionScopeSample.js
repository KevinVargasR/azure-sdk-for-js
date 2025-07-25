/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is regenerated.
 */

const { DeploymentsClient } = require("@azure/arm-resourcesdeployments");
const { DefaultAzureCredential } = require("@azure/identity");
require("dotenv/config");

/**
 * This sample demonstrates how to Validates whether the specified template is syntactically correct and will be accepted by Azure Resource Manager..
 *
 * @summary Validates whether the specified template is syntactically correct and will be accepted by Azure Resource Manager..
 * x-ms-original-file: specification/resources/resource-manager/Microsoft.Resources/deployments/stable/2025-04-01/examples/PostDeploymentValidateOnSubscription.json
 */
async function validatesATemplateAtSubscriptionScope() {
  const subscriptionId =
    process.env["RESOURCES_SUBSCRIPTION_ID"] || "00000000-0000-0000-0000-000000000001";
  const deploymentName = "my-deployment";
  const parameters = {
    location: "eastus",
    properties: {
      mode: "Incremental",
      parameters: {},
      templateLink: { uri: "https://example.com/exampleTemplate.json" },
    },
  };
  const credential = new DefaultAzureCredential();
  const client = new DeploymentsClient(credential, subscriptionId);
  const result = await client.deployments.beginValidateAtSubscriptionScopeAndWait(
    deploymentName,
    parameters,
  );
  console.log(result);
}

async function main() {
  await validatesATemplateAtSubscriptionScope();
}

main().catch(console.error);
