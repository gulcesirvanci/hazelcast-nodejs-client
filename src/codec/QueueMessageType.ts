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
export class QueueMessageType {
    static QUEUE_OFFER = 0x0301;
    static QUEUE_PUT = 0x0302;
    static QUEUE_SIZE = 0x0303;
    static QUEUE_REMOVE = 0x0304;
    static QUEUE_POLL = 0x0305;
    static QUEUE_TAKE = 0x0306;
    static QUEUE_PEEK = 0x0307;
    static QUEUE_ITERATOR = 0x0308;
    static QUEUE_DRAINTO = 0x0309;
    static QUEUE_DRAINTOMAXSIZE = 0x030a;
    static QUEUE_CONTAINS = 0x030b;
    static QUEUE_CONTAINSALL = 0x030c;
    static QUEUE_COMPAREANDREMOVEALL = 0x030d;
    static QUEUE_COMPAREANDRETAINALL = 0x030e;
    static QUEUE_CLEAR = 0x030f;
    static QUEUE_ADDALL = 0x0310;
    static QUEUE_ADDLISTENER = 0x0311;
    static QUEUE_REMOVELISTENER = 0x0312;
    static QUEUE_REMAININGCAPACITY = 0x0313;
    static QUEUE_ISEMPTY = 0x0314;
}
