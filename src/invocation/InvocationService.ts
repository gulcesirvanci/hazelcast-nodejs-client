/*
 * Copyright (c) 2008-2019, Hazelcast, Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Buffer} from 'safe-buffer';
import * as assert from 'assert';
import {AssertionError} from 'assert';
import * as Promise from 'bluebird';
import * as Long from 'long';
import {BitsUtil} from '../BitsUtil';
import HazelcastClient from '../HazelcastClient';
import {
    ClientNotActiveError, HazelcastError,
    HazelcastInstanceNotActiveError,
    InvocationTimeoutError,
    IOError,
    RetryableHazelcastError,
} from '../HazelcastError';
import {ClientConnection} from './ClientConnection';
import {DeferredPromise} from '../Util';
import {ILogger} from '../logging/ILogger';
import {ListenerMessageCodec} from '../ListenerMessageCodec';
import {ClientLocalBackupListenerCodec} from '../codec/ClientLocalBackupListenerCodec';
import Address = require('../Address');
import ClientMessage = require('../ClientMessage');

const EXCEPTION_MESSAGE_TYPE = 109;
const MAX_FAST_INVOCATION_COUNT = 5;
const PROPERTY_INVOCATION_RETRY_PAUSE_MILLIS = 'hazelcast.client.invocation.retry.pause.millis';
const PROPERTY_INVOCATION_TIMEOUT_MILLIS = 'hazelcast.client.invocation.timeout.millis';

/**
 * A request to be sent to a hazelcast node.
 */
export class Invocation {

    client: HazelcastClient;
    invocationService: InvocationService;
    /**
     * Representatiton of the request in binary form.
     */
    request: ClientMessage;
    /**
     * Partition id of the request. If request is not bound to a specific partition, should be set to -1.
     */
    partitionId: number;
    /**
     * Address of the request. If request is not bound to any specific address, should be set to null.
     */
    address: Address;
    /**
     * Deadline of validity. Client will not try to send this request to server after the deadline passes.
     */
    deadline: Date;
    /**
     * Connection of the request. If request is not bound to any specific address, should be set to null.
     */
    connection: ClientConnection;
    /**
     * Promise managing object.
     */
    deferred: Promise.Resolver<ClientMessage>;
    invokeCount: number = 0;
    /**
     * If this is an event listener registration, handler should be set to the function to be called on events.
     * Otherwise, should be set to null.
     */
    handler: (...args: any[]) => any;

    backupsAcksReceived: number = 0;

    pendingResponseMessage: ClientMessage;

    backupsAcksExpected: number = -1;

    pendingResponseReceivedMillis: number = -1;

    constructor(client: HazelcastClient, request: ClientMessage) {
        this.client = client;
        this.invocationService = client.getInvocationService();
        this.deadline = new Date(new Date().getTime() + this.invocationService.getInvocationTimeoutMillis());
        this.request = request;
    }

    static isRetrySafeError(err: Error): boolean {
        return err instanceof IOError || err instanceof HazelcastInstanceNotActiveError || err instanceof RetryableHazelcastError;
    }

    /**
     * @returns {boolean}
     */
    hasPartitionId(): boolean {
        return this.hasOwnProperty('partitionId') && this.partitionId >= 0;
    }

    isAllowedToRetryOnSelection(err: Error): boolean {
        return (this.connection == null && this.address == null) || !(err instanceof IOError);
    }

    notifyBackup(): void {
        const newBackupAcksCompleted = ++this.backupsAcksReceived;
        const pendingResponse = this.pendingResponseMessage;

        if (pendingResponse === null) {
            return;
        }

        const backupAcksExpected = this.backupsAcksExpected;

        if (backupAcksExpected < newBackupAcksCompleted) {
            return;
        }

        if (backupAcksExpected !== newBackupAcksCompleted) {
            return;
        }
        this.complete(pendingResponse);
    }

    notify(clientMessage: ClientMessage): void {
        if (clientMessage === null) {
            // @ts-ignore
            this.invocationService.notifyError(this, new AssertionError({
                message: 'response can\'t be null',
            }));
        }
        const expectedBackups = clientMessage.getNumberOfBackupAcks();

        if (expectedBackups > this.backupsAcksReceived) {
            this.pendingResponseReceivedMillis = Date.now();
            this.backupsAcksExpected = expectedBackups;
            this.pendingResponseMessage = clientMessage;
            if (this.backupsAcksReceived !== expectedBackups) {
                return;
            }
        }
        this.complete(clientMessage);
    }

    complete(obj: any): void {
        this.deferred.resolve(obj);
        this.invocationService.deRegisterInvocation(this.request.getCorrelationId().toNumber());
    }

    detectAndHandleBackupTimeout(timeoutMillis: number): boolean {
        const backupsCompleted = this.backupsAcksExpected === this.backupsAcksReceived;
        const responseReceivedMillis = this.pendingResponseReceivedMillis;
        const expirationTime = responseReceivedMillis + timeoutMillis;
        const timeout = expirationTime > 0 && expirationTime < Date.now();
        const responseReceived = this.pendingResponseMessage != null;

        if (backupsCompleted || !responseReceived || !timeout) {
            return false;
        }

        if (this.shouldFailOnIndeterminateOperationState()) {
            this.complete(new HazelcastError(this + ' failed because backup acks missed.'));
            return true;
        }
        this.complete(this.pendingResponseMessage);
        return true;
    }

    private shouldFailOnIndeterminateOperationState(): boolean {
        return this.invocationService.shouldFailOnIndeterminateOperationState;
    }
}

/**
 * Sends requests to appropriate nodes. Resolves waiting promises with responses.
 */
export class InvocationService {
    static backupListener: ListenerMessageCodec = {
        encodeAddRequest(localOnly: boolean): ClientMessage {
            return ClientLocalBackupListenerCodec.encodeRequest();
        },
        decodeAddResponse(msg: ClientMessage): string {
            return ClientLocalBackupListenerCodec.decodeResponse(msg).response;
        },
        encodeRemoveRequest(listenerId: string): ClientMessage {
            return null;
        },
    };

    doInvoke: (invocation: Invocation) => void;
    operationBackupTimeoutMillis: number;
    shouldFailOnIndeterminateOperationState: boolean;
    private correlationCounter = 1;
    private eventHandlers: { [id: number]: Invocation } = {};
    private pending: { [id: number]: Invocation } = {};
    private client: HazelcastClient;
    private smartRoutingEnabled: boolean;
    private readonly invocationRetryPauseMillis: number;
    private readonly invocationTimeoutMillis: number;
    private logger: ILogger;
    private isShutdown: boolean;

    constructor(hazelcastClient: HazelcastClient) {
        this.client = hazelcastClient;
        this.logger = this.client.getLoggingService().getLogger();
        this.smartRoutingEnabled = hazelcastClient.getConfig().networkConfig.smartRouting;
        if (hazelcastClient.getConfig().networkConfig.smartRouting) {
            this.doInvoke = this.invokeSmart;
        } else {
            this.doInvoke = this.invokeNonSmart;
        }
        this.invocationRetryPauseMillis = this.client.getConfig().properties[PROPERTY_INVOCATION_RETRY_PAUSE_MILLIS] as number;
        this.invocationTimeoutMillis = this.client.getConfig().properties[PROPERTY_INVOCATION_TIMEOUT_MILLIS] as number;
        this.isShutdown = false;
        this.operationBackupTimeoutMillis = this.client.getConfig()
            .properties['hazelcast.client.operation.backup.timeout.millis'] as number;
        this.shouldFailOnIndeterminateOperationState = this.client.getConfig()
            .properties['hazelcast.client.operation.fail.on.indeterminate.state'] as boolean;
    }

    shutdown(): void {
        this.isShutdown = true;
    }

    addBackupListener(): void {
        const listenerService = this.client.getListenerService();
        listenerService.registerListener(InvocationService.backupListener, this.backupEventHandler);
    }

    backupEventHandler(correlationId: number): void {
        const invocation = this.pending[correlationId];
        if (invocation === null) {
            this.logger.trace('InvocationService', 'Invocation not found for backup event, invocation id ' + correlationId);
            return;
        }
        invocation.notifyBackup();
    }

    invoke(invocation: Invocation): Promise<ClientMessage> {
        const newCorrelationId = Long.fromNumber(this.correlationCounter++);
        invocation.deferred = DeferredPromise<ClientMessage>();
        invocation.request.setCorrelationId(newCorrelationId);
        this.doInvoke(invocation);
        return invocation.deferred.promise;
    }

    /**
     * Invokes given invocation on specified connection.
     * @param connection
     * @param request
     * @param handler called with values returned from server for this invocation.
     * @returns
     */
    invokeOnConnection(connection: ClientConnection, request: ClientMessage,
                       handler?: (...args: any[]) => any): Promise<ClientMessage> {
        const invocation = new Invocation(this.client, request);
        invocation.connection = connection;
        if (handler) {
            invocation.handler = handler;
        }
        return this.invoke(invocation);
    }

    /**
     * Invokes given invocation on the node that owns given partition.
     * @param request
     * @param partitionId
     * @returns
     */
    invokeOnPartition(request: ClientMessage, partitionId: number): Promise<ClientMessage> {
        const invocation = new Invocation(this.client, request);
        invocation.partitionId = partitionId;
        return this.invoke(invocation);
    }

    /**
     * Invokes given invocation on the host with given address.
     * @param request
     * @param target
     * @returns
     */
    invokeOnTarget(request: ClientMessage, target: Address): Promise<ClientMessage> {
        const invocation = new Invocation(this.client, request);
        invocation.address = target;
        return this.invoke(invocation);
    }

    /**
     * Invokes given invocation on any host.
     * Useful when an operation is not bound to any host but a generic operation.
     * @param request
     * @returns
     */
    invokeOnRandomTarget(request: ClientMessage): Promise<ClientMessage> {
        return this.invoke(new Invocation(this.client, request));
    }

    getInvocationTimeoutMillis(): number {
        return this.invocationTimeoutMillis;
    }

    getInvocationRetryPauseMillis(): number {
        return this.invocationRetryPauseMillis;
    }

    /**
     * Removes the handler for all event handlers with a specific correlation id.
     * @param id correlation id
     */
    removeEventHandler(id: number): void {
        if (this.eventHandlers.hasOwnProperty('' + id)) {
            delete this.eventHandlers[id];
        }
    }

    handleResponse(clientMessage: ClientMessage): void {
        if (clientMessage.hasFlags(BitsUtil.BACKUP_EVENT_FLAG)) {
            setImmediate(() => {
                if (this.eventHandlers[correlationId] !== undefined) {
                    this.eventHandlers[correlationId].handler(clientMessage);
                }
            });
            return;
        }
        const correlationId = clientMessage.getCorrelationId().toNumber();
        const messageType = clientMessage.getMessageType();
        const pendingInvocation = this.pending[correlationId];
        if (messageType === EXCEPTION_MESSAGE_TYPE) {
            const remoteError = this.client.getErrorFactory().createErrorFromClientMessage(clientMessage);
            this.notifyError(pendingInvocation, remoteError);
        } else {
            pendingInvocation.notify(clientMessage);
        }
    }

    /**
     * Extract codec specific properties in a protocol message and resolves waiting promise.
     * @param buffer
     */
    processResponse(buffer: Buffer): void {
        const clientMessage = new ClientMessage(buffer);
        const correlationId = clientMessage.getCorrelationId().toNumber();

        if (clientMessage.hasFlags(BitsUtil.BACKUP_EVENT_FLAG)) {
            this.handleResponse(clientMessage);
        } else if (clientMessage.hasFlags(BitsUtil.LISTENER_FLAG)) {
            setImmediate(() => {
                if (this.eventHandlers[correlationId] !== undefined) {
                    this.eventHandlers[correlationId].handler(clientMessage);
                }
            });
            return;
        } else {
            this.handleResponse(clientMessage);
        }
    }

    deRegisterInvocation(correlationId: number): void {
        delete this.pending[correlationId];
    }

    notifyError(invocation: Invocation, error: Error): void {
        const correlationId = invocation.request.getCorrelationId().toNumber();
        if (this.rejectIfNotRetryable(invocation, error)) {
            delete this.pending[invocation.request.getCorrelationId().toNumber()];
            return;
        }
        this.logger.debug('InvocationService',
            'Retrying(' + invocation.invokeCount + ') on correlation-id=' + correlationId, error);
        if (invocation.invokeCount < MAX_FAST_INVOCATION_COUNT) {
            this.doInvoke(invocation);
        } else {
            setTimeout(this.doInvoke.bind(this, invocation), this.getInvocationRetryPauseMillis());
        }
    }

    private invokeSmart(invocation: Invocation): void {
        let invocationPromise: Promise<void>;
        invocation.invokeCount++;
        if (invocation.hasOwnProperty('connection')) {
            invocationPromise = this.send(invocation, invocation.connection);
        } else if (invocation.hasPartitionId()) {
            invocationPromise = this.invokeOnPartitionOwner(invocation, invocation.partitionId);
        } else if (invocation.hasOwnProperty('address')) {
            invocationPromise = this.invokeOnAddress(invocation, invocation.address);
        } else {
            invocationPromise = this.invokeOnOwner(invocation);
        }
        invocationPromise.catch((err) => {
            this.notifyError(invocation, err);
        });
    }

    private invokeNonSmart(invocation: Invocation): void {
        let invocationPromise: Promise<void>;
        invocation.invokeCount++;
        if (invocation.hasOwnProperty('connection')) {
            invocationPromise = this.send(invocation, invocation.connection);
        } else {
            invocationPromise = this.invokeOnOwner(invocation);
        }
        invocationPromise.catch((err) => {
            this.notifyError(invocation, err);
        });
    }

    private invokeOnOwner(invocation: Invocation): Promise<void> {
        const owner = this.client.getClusterService().getOwnerConnection();
        if (owner == null) {
            return Promise.reject(new IOError('Unisocket client\'s owner connection is not available.'));
        }
        return this.send(invocation, owner);
    }

    private invokeOnAddress(invocation: Invocation, address: Address): Promise<void> {
        return this.client.getConnectionManager().getOrConnect(address).then((connection: ClientConnection) => {
            return this.send(invocation, connection);
        }).catch((e) => {
            this.logger.debug('InvocationService', e);
            throw new IOError(address.toString() + ' is not available.', e);
        });
    }

    private invokeOnPartitionOwner(invocation: Invocation, partitionId: number): Promise<void> {
        const ownerAddress = this.client.getPartitionService().getAddressForPartition(partitionId);
        return this.client.getConnectionManager().getOrConnect(ownerAddress).then((connection: ClientConnection) => {
            return this.send(invocation, connection);
        }).catch((e) => {
            this.logger.debug('InvocationService', e);
            throw new IOError(ownerAddress.toString() + '(partition owner) is not available.', e);
        });
    }

    private send(invocation: Invocation, connection: ClientConnection): Promise<void> {
        assert(connection != null);
        if (this.isShutdown) {
            return Promise.reject(new ClientNotActiveError('Client is shutdown.'));
        }
        invocation.request.addFlag(BitsUtil.BACKUP_AWARE_FLAG);
        this.registerInvocation(invocation);
        return this.write(invocation, connection);
    }

    private write(invocation: Invocation, connection: ClientConnection): Promise<void> {
        return connection.write(invocation.request.getBuffer());
    }

    /**
     * Determines if an error is retryable. The given invocation is rejected with approprate error if the error is not retryable.
     * @param invocation
     * @param error
     * @returns `true` if invocation is rejected, `false` otherwise
     */
    private rejectIfNotRetryable(invocation: Invocation, error: Error): boolean {
        if (!this.client.getLifecycleService().isRunning()) {
            invocation.deferred.reject(new ClientNotActiveError('Client is not active.', error));
            return true;
        }
        if (!invocation.isAllowedToRetryOnSelection(error)) {
            invocation.deferred.reject(error);
            return true;
        }
        if (!Invocation.isRetrySafeError(error)) {
            invocation.deferred.reject(error);
            return true;
        }
        if (invocation.deadline.getTime() < Date.now()) {
            this.logger.trace('InvocationService', 'Error will not be retried because invocation timed out');
            invocation.deferred.reject(new InvocationTimeoutError('Invocation ' + invocation.request.getCorrelationId() + ')'
                + ' reached its deadline.', error));
            return true;
        }
    }

    private registerInvocation(invocation: Invocation): void {
        const message = invocation.request;
        const correlationId = message.getCorrelationId().toNumber();
        if (invocation.hasPartitionId()) {
            message.setPartitionId(invocation.partitionId);
        } else {
            message.setPartitionId(-1);
        }
        if (invocation.hasOwnProperty('handler')) {
            this.eventHandlers[correlationId] = invocation;
        }
        this.pending[correlationId] = invocation;
    }

}
