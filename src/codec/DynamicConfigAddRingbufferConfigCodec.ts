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

import * as Long from 'long';
import {Address} from '../Address';
import {AddressCodec} from '../builtin/AddressCodec';
import {MemberCodec} from '../builtin/MemberCodec';
import {Data} from '../serialization/Data';
import {SimpleEntryViewCodec} from '../builtin/SimpleEntryViewCodec';
import {DistributedObjectInfoCodec} from '../builtin/DistributedObjectInfoCodec';
import {DistributedObjectInfo} from '../builtin/DistributedObjectInfo';
import {Member} from '../core/Member';
import {UUID} from '../core/UUID';
import {FixedSizeTypes} from '../builtin/FixedSizeTypes';
import {BitsUtil} from '../BitsUtil';
import {ClientConnection} from '../invocation/ClientConnection';
import {ClientMessage, Frame} from '../ClientMessage';
import {Buffer} from 'safe-buffer';
import {ClientProtocolErrorCodes} from '../protocol/ClientProtocolErrorCodes';
import {CodecUtil} from '../builtin/CodecUtil';
import {DataCodec} from '../builtin/DataCodec';
import {ErrorCodec} from '../protocol/ErrorCodec';
import {ErrorsCodec} from '../protocol/ErrorsCodec';
import {ListIntegerCodec} from '../builtin/ListIntegerCodec';
import {ListUUIDCodec} from '../builtin/ListUUIDCodec';
import {ListLongCodec} from '../builtin/ListLongCodec';
import {ListMultiFrameCodec} from '../builtin/ListMultiFrameCodec';
import {LongArrayCodec} from '../builtin/LongArrayCodec';
import {MapCodec} from '../builtin/MapCodec';
import {MapIntegerLongCodec} from '../builtin/MapIntegerLongCodec';
import {MapIntegerUUIDCodec} from '../builtin/MapIntegerUUIDCodec';
import {MapStringLongCodec} from '../builtin/MapStringLongCodec';
import {MapUUIDLongCodec} from '../builtin/MapUUIDLongCodec';
import {StackTraceElementCodec} from '../protocol/StackTraceElementCodec';
import {StringCodec} from '../builtin/StringCodec';

/* tslint:disabled:URF-UNREAD-PUBLIC-OR-PROTECTED-FIELD */
export class RequestParameters {

    /**
     * ringbuffer configuration name
     */
    public name: string;

    /**
     * capacity of the ringbuffer
     */
    public capacity: number;

    /**
     * number of synchronous backups
     */
    public backupCount: number;

    /**
     * number of asynchronous backups
     */
    public asyncBackupCount: number;

    /**
     * maximum number of seconds for each entry to stay in the ringbuffer
     */
    public timeToLiveSeconds: number;

    /**
     * in memory format of items in the ringbuffer. Valid options are {@code BINARY}
     * and {@code OBJECT}
     */
    public inMemoryFormat: string;

    /**
     * backing ringbuffer store configuration
     */
    public ringbufferStoreConfig: RingbufferStoreConfigHolder;

    /**
     * name of an existing configured split brain protection to be used to determine the minimum number of members
     * required in the cluster for the lock to remain functional. When {@code null}, split brain protection does not
     * apply to this lock configuration's operations.
     */
    public splitBrainProtectionName: string;

    /**
     * TODO DOC
     */
    public mergePolicy: string;

    /**
     * TODO DOC
     */
    public mergeBatchSize: number;
}

/* tslint:disable:URF-UNREAD-PUBLIC-OR-PROTECTED-FIELD */
export class ResponseParameters {
}

/**
 * Adds a new ringbuffer configuration to a running cluster.
 * If a ringbuffer configuration with the given {@code name} already exists, then
 * the new ringbuffer config is ignored and the existing one is preserved.
 */
/* tslint:disable:max-line-length no-bitwise */
export class DynamicConfigAddRingbufferConfigCodec {
    // hex: 0x1E0200
    public static REQUEST_MESSAGE_TYPE = 1966592;
    // hex: 0x1E0201
    public static RESPONSE_MESSAGE_TYPE = 1966593;
    private static REQUEST_CAPACITY_FIELD_OFFSET = ClientMessage.PARTITION_ID_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static REQUEST_BACKUP_COUNT_FIELD_OFFSET = DynamicConfigAddRingbufferConfigCodec.REQUEST_CAPACITY_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static REQUEST_ASYNC_BACKUP_COUNT_FIELD_OFFSET = DynamicConfigAddRingbufferConfigCodec.REQUEST_BACKUP_COUNT_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static REQUEST_TIME_TO_LIVE_SECONDS_FIELD_OFFSET = DynamicConfigAddRingbufferConfigCodec.REQUEST_ASYNC_BACKUP_COUNT_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static REQUEST_MERGE_BATCH_SIZE_FIELD_OFFSET = DynamicConfigAddRingbufferConfigCodec.REQUEST_TIME_TO_LIVE_SECONDS_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static REQUEST_INITIAL_FRAME_SIZE = DynamicConfigAddRingbufferConfigCodec.REQUEST_MERGE_BATCH_SIZE_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static RESPONSE_INITIAL_FRAME_SIZE = ClientMessage.CORRELATION_ID_FIELD_OFFSET + FixedSizeTypes.LONG_SIZE_IN_BYTES;

    static encodeRequest(name: string, capacity: number, backupCount: number, asyncBackupCount: number, timeToLiveSeconds: number, inMemoryFormat: string, ringbufferStoreConfig: RingbufferStoreConfigHolder, splitBrainProtectionName: string, mergePolicy: string, mergeBatchSize: number): ClientMessage {
        const clientMessage = ClientMessage.createForEncode();
        clientMessage.setRetryable(false);
        clientMessage.setAcquiresResource(false);
        clientMessage.setOperationName('DynamicConfig.AddRingbufferConfig');
        const initialFrame: Frame = new Frame(Buffer.allocUnsafe(DynamicConfigAddRingbufferConfigCodec.REQUEST_INITIAL_FRAME_SIZE), ClientMessage.UNFRAGMENTED_MESSAGE);
        FixedSizeTypes.encodeInt(initialFrame.content, ClientMessage.TYPE_FIELD_OFFSET, DynamicConfigAddRingbufferConfigCodec.REQUEST_MESSAGE_TYPE);
        FixedSizeTypes.encodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_CAPACITY_FIELD_OFFSET, capacity);
        FixedSizeTypes.encodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_BACKUP_COUNT_FIELD_OFFSET, backupCount);
        FixedSizeTypes.encodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_ASYNC_BACKUP_COUNT_FIELD_OFFSET, asyncBackupCount);
        FixedSizeTypes.encodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_TIME_TO_LIVE_SECONDS_FIELD_OFFSET, timeToLiveSeconds);
        FixedSizeTypes.encodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_MERGE_BATCH_SIZE_FIELD_OFFSET, mergeBatchSize);
        clientMessage.add(initialFrame);
        StringCodec.encode(clientMessage, name);
        StringCodec.encode(clientMessage, inMemoryFormat);
        CodecUtil.encodeNullable(clientMessage,  ringbufferStoreConfig, RingbufferStoreConfigHolderCodec.encode );
        CodecUtil.encodeNullable(clientMessage,  splitBrainProtectionName, StringCodec.encode );
        StringCodec.encode(clientMessage, mergePolicy);
        return clientMessage;
    }

    static decodeRequest(clientMessage: ClientMessage): RequestParameters {
        const request: RequestParameters = new RequestParameters();
        const frame: Frame = clientMessage.get();
        const initialFrame: Frame = frame.next;
        request.capacity =  FixedSizeTypes.decodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_CAPACITY_FIELD_OFFSET);
        request.backupCount =  FixedSizeTypes.decodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_BACKUP_COUNT_FIELD_OFFSET);
        request.asyncBackupCount =  FixedSizeTypes.decodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_ASYNC_BACKUP_COUNT_FIELD_OFFSET);
        request.timeToLiveSeconds =  FixedSizeTypes.decodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_TIME_TO_LIVE_SECONDS_FIELD_OFFSET);
        request.mergeBatchSize =  FixedSizeTypes.decodeInt(initialFrame.content, DynamicConfigAddRingbufferConfigCodec.REQUEST_MERGE_BATCH_SIZE_FIELD_OFFSET);
        request.name = StringCodec.decode(frame);
        request.inMemoryFormat = StringCodec.decode(frame);
        request.ringbufferStoreConfig = CodecUtil.decodeNullable(frame, RingbufferStoreConfigHolderCodec.decode);
        request.splitBrainProtectionName = CodecUtil.decodeNullable(frame, StringCodec.decode);
        request.mergePolicy = StringCodec.decode(frame);
        return request;
    }

     static encodeResponse(): ClientMessage {
        const clientMessage = ClientMessage.createForEncode();
        const initialFrame: Frame = new Frame(Buffer.allocUnsafe(DynamicConfigAddRingbufferConfigCodec.RESPONSE_INITIAL_FRAME_SIZE), ClientMessage.UNFRAGMENTED_MESSAGE);
        FixedSizeTypes.encodeInt(initialFrame.content, ClientMessage.TYPE_FIELD_OFFSET, DynamicConfigAddRingbufferConfigCodec.RESPONSE_MESSAGE_TYPE);
        clientMessage.add(initialFrame);

        return clientMessage;
    }

     static decodeResponse(clientMessage: ClientMessage): ResponseParameters {
        const response: ResponseParameters = new ResponseParameters();
        // empty initial frame
        let frame: Frame = clientMessage.get();
        frame = frame.next;
        return response;
    }
}