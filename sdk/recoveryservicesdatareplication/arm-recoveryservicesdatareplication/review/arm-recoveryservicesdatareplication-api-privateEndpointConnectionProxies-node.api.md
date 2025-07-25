## API Report File for "@azure/arm-recoveryservicesdatareplication"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { Client } from '@azure-rest/core-client';
import { OperationOptions } from '@azure-rest/core-client';
import { OperationState } from '@azure/core-lro';
import { PollerLike } from '@azure/core-lro';

// @public
export function $delete(context: AzureSiteRecoveryManagementServiceAPIContext, resourceGroupName: string, vaultName: string, privateEndpointConnectionProxyName: string, options?: PrivateEndpointConnectionProxiesDeleteOptionalParams): PollerLike<OperationState<void>, void>;

// @public
export function create(context: AzureSiteRecoveryManagementServiceAPIContext, resourceGroupName: string, vaultName: string, privateEndpointConnectionProxyName: string, resource: PrivateEndpointConnectionProxy, options?: PrivateEndpointConnectionProxiesCreateOptionalParams): Promise<PrivateEndpointConnectionProxy>;

// @public
export function get(context: AzureSiteRecoveryManagementServiceAPIContext, resourceGroupName: string, vaultName: string, privateEndpointConnectionProxyName: string, options?: PrivateEndpointConnectionProxiesGetOptionalParams): Promise<PrivateEndpointConnectionProxy>;

// @public
export function list(context: AzureSiteRecoveryManagementServiceAPIContext, resourceGroupName: string, vaultName: string, options?: PrivateEndpointConnectionProxiesListOptionalParams): PagedAsyncIterableIterator<PrivateEndpointConnectionProxy>;

// @public
export interface PrivateEndpointConnectionProxiesCreateOptionalParams extends OperationOptions {
}

// @public
export interface PrivateEndpointConnectionProxiesDeleteOptionalParams extends OperationOptions {
    updateIntervalInMs?: number;
}

// @public
export interface PrivateEndpointConnectionProxiesGetOptionalParams extends OperationOptions {
}

// @public
export interface PrivateEndpointConnectionProxiesListOptionalParams extends OperationOptions {
}

// @public
export interface PrivateEndpointConnectionProxiesValidateOptionalParams extends OperationOptions {
}

// @public
export function validate(context: AzureSiteRecoveryManagementServiceAPIContext, resourceGroupName: string, vaultName: string, privateEndpointConnectionProxyName: string, body: PrivateEndpointConnectionProxy, options?: PrivateEndpointConnectionProxiesValidateOptionalParams): Promise<PrivateEndpointConnectionProxy>;

// (No @packageDocumentation comment for this package)

```
