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

var Client = require('hazelcast-client').Client;
var Predicates = require('hazelcast-client').Predicates;

Client.newHazelcastClient().then(function (hazelcastClient) {
    var client = hazelcastClient;
    var personMap;
    client.getMap('persons').then(function (mp) {
        personMap = mp;
        return personMap.put('Alice', 35);
    }).then(function () {
        return personMap.put('Andy', 37);
    }).then(function () {
        return personMap.put('Bob', 22);
    }).then(function () {
        var predicate = new Predicates.sql('__key like A%');
        return personMap.valuesWithPredicate(predicate);
    }).then(function (startingWithA) {
        console.log(startingWithA.get(0)); // 35
        return client.shutdown();
    });

});


/*


In this example, the code creates a list with the values whose keys start with the letter "A”.

You can use the this attribute to perform a predicated search for entry values. See the following example:

var personMap;
return client.getMap('persons').then(function (mp) {
    personMap = mp;
    return personMap.put('Alice', 35);
}).then(function () {
    return personMap.put('Andy', 37);
}).then(function () {
    return personMap.put('Bob', 22);
}).then(function () {
    var predicate = new Predicates.greaterEqual('this', 27);
    return personMap.valuesWithPredicate(predicate);
}).then(function (olderThan27) {
    console.log(olderThan27.get(0), olderThan27.get(1)); // 35 37
});
In this example, the code creates a list with the values greater than or equal to "27".




 */
