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
     * Name of the Semaphore
     */
    public name: string;

    /**
     * The number of permits to add
     * @throws IllegalArgumentException if {@code increase} is negative
     */
    public increase: number;
}

/* tslint:disable:URF-UNREAD-PUBLIC-OR-PROTECTED-FIELD */
export class ResponseParameters {
}

/**
 * Increases the number of available permits by the indicated amount. This method differs from {@code release}
 * in that it does not effect the amount of permits this caller has attached.
 */
/* tslint:disable:max-line-length no-bitwise */
export class SemaphoreIncreasePermitsCodec {
    // hex: 0x0D0800
    public static REQUEST_MESSAGE_TYPE = 854016;
    // hex: 0x0D0801
    public static RESPONSE_MESSAGE_TYPE = 854017;
    private static REQUEST_INCREASE_FIELD_OFFSET = ClientMessage.PARTITION_ID_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static REQUEST_INITIAL_FRAME_SIZE = SemaphoreIncreasePermitsCodec.REQUEST_INCREASE_FIELD_OFFSET + FixedSizeTypes.INT_SIZE_IN_BYTES;
    private static RESPONSE_INITIAL_FRAME_SIZE = ClientMessage.CORRELATION_ID_FIELD_OFFSET + FixedSizeTypes.LONG_SIZE_IN_BYTES;

    static encodeRequest(name: string, increase: number): ClientMessage {
        const clientMessage = ClientMessage.createForEncode();
        clientMessage.setRetryable(false);
        clientMessage.setAcquiresResource(true);
        clientMessage.setOperationName('Semaphore.IncreasePermits');
        const initialFrame: Frame = new Frame(Buffer.allocUnsafe(SemaphoreIncreasePermitsCodec.REQUEST_INITIAL_FRAME_SIZE), ClientMessage.UNFRAGMENTED_MESSAGE);
        FixedSizeTypes.encodeInt(initialFrame.content, ClientMessage.TYPE_FIELD_OFFSET, SemaphoreIncreasePermitsCodec.REQUEST_MESSAGE_TYPE);
        FixedSizeTypes.encodeInt(initialFrame.content, SemaphoreIncreasePermitsCodec.REQUEST_INCREASE_FIELD_OFFSET, increase);
        clientMessage.add(initialFrame);
        StringCodec.encode(clientMessage, name);
        return clientMessage;
    }

    static decodeRequest(clientMessage: ClientMessage): RequestParameters {
        const request: RequestParameters = new RequestParameters();
        const frame: Frame = clientMessage.get();
        const initialFrame: Frame = frame.next;
        request.increase =  FixedSizeTypes.decodeInt(initialFrame.content, SemaphoreIncreasePermitsCodec.REQUEST_INCREASE_FIELD_OFFSET);
        request.name = StringCodec.decode(frame);
        return request;
    }

     static encodeResponse(): ClientMessage {
        const clientMessage = ClientMessage.createForEncode();
        const initialFrame: Frame = new Frame(Buffer.allocUnsafe(SemaphoreIncreasePermitsCodec.RESPONSE_INITIAL_FRAME_SIZE), ClientMessage.UNFRAGMENTED_MESSAGE);
        FixedSizeTypes.encodeInt(initialFrame.content, ClientMessage.TYPE_FIELD_OFFSET, SemaphoreIncreasePermitsCodec.RESPONSE_MESSAGE_TYPE);
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