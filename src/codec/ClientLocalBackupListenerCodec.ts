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

/* tslint:disable */
import ClientMessage = require('../ClientMessage');
import {BitsUtil} from '../BitsUtil';
import Address = require('../Address');
import {AddressCodec} from './AddressCodec';
import {UUIDCodec} from './UUIDCodec';
import {MemberCodec} from './MemberCodec';
import {Data} from '../serialization/Data';
import {EntryViewCodec} from './EntryViewCodec';
import DistributedObjectInfoCodec = require('./DistributedObjectInfoCodec');
import {Member} from '../core/Member';
import {UUID} from '../core/UUID';
import {ClientMessageType} from './ClientMessageType';

var REQUEST_TYPE = ClientMessageType.CLIENT_LOCALBACKUPLISTENER;
var RESPONSE_TYPE = 104;
var RETRYABLE = false;


export class ClientLocalBackupListenerCodec {
    static calculateSize(){
        var dataSize : number = 0;
        return dataSize;
    }

    static encodeRequest(){
        var clientMessage = ClientMessage.newClientMessage(this.calculateSize());
        clientMessage.setMessageType(REQUEST_TYPE);
        clientMessage.setRetryable(RETRYABLE);
        clientMessage.updateFrameLength();
        return clientMessage;
    }

    static decodeResponse(clientMessage : ClientMessage,  toObjectFunction: (data: Data) => any = null){
        var parameters :any = {
            'response' : null 
        };

                    parameters['response'] = clientMessage.readString();
        
    return parameters;
    }

    static handle(clientMessage : ClientMessage, handleEventBackup : any ,toObjectFunction: (data: Data) => any = null){
        var messageType = clientMessage.getMessageType();
        if ( messageType === BitsUtil.EVENT_BACKUP && handleEventBackup !== null) {
            var messageFinished = false;
            var backupId : any = undefined;
            if (!messageFinished) {
                    backupId = clientMessage.readLong();
            }
        handleEventBackup(backupId);
        }
    }
}
