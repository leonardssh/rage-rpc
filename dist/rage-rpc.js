'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var MpTypes;
(function (MpTypes) {
    MpTypes["Blip"] = "b";
    MpTypes["Checkpoint"] = "cp";
    MpTypes["Colshape"] = "c";
    MpTypes["Label"] = "l";
    MpTypes["Marker"] = "m";
    MpTypes["Object"] = "o";
    MpTypes["Pickup"] = "p";
    MpTypes["Player"] = "pl";
    MpTypes["Vehicle"] = "v";
})(MpTypes || (MpTypes = {}));
let DEBUG_MODE = false;
function setDebugMode(state) {
    DEBUG_MODE = state;
}
function getEnvironment() {
    if (mp.joaat) {
        return 'server';
    }
    if (mp.game && mp.game.joaat) {
        return 'client';
    }
    if (mp.trigger) {
        return 'cef';
    }
    throw new Error('Unknown RAGE environment');
}
function log(data, type = 'info') {
    if (!DEBUG_MODE) {
        return;
    }
    const env = getEnvironment();
    const isClient = mp.console;
    const clientFormatLog = {
        info: 'logInfo',
        error: 'logError',
        warn: 'logWarn'
    };
    (isClient ? mp.console : console)[isClient ? clientFormatLog[type] : type === 'info' ? 'log' : type](`RPC (${env}): ${data}`);
}
function isObjectMpType(obj, type) {
    const client = getEnvironment() === 'client';
    if (obj && typeof obj === 'object' && typeof obj.id !== 'undefined') {
        const validate = (type, collection, mpType) => client ? obj.type === type && collection.at(obj.id) === obj : obj instanceof mpType;
        switch (type) {
            case MpTypes.Blip:
                return validate('blip', mp.blips, mp.Blip);
            case MpTypes.Checkpoint:
                return validate('checkpoint', mp.checkpoints, mp.Checkpoint);
            case MpTypes.Colshape:
                return validate('colshape', mp.colshapes, mp.Colshape);
            case MpTypes.Label:
                return validate('textlabel', mp.labels, mp.TextLabel);
            case MpTypes.Marker:
                return validate('marker', mp.markers, mp.Marker);
            case MpTypes.Object:
                return validate('object', mp.objects, mp.Object);
            case MpTypes.Pickup:
                return validate('pickup', mp.pickups, mp.Pickup);
            case MpTypes.Player:
                return validate('player', mp.players, mp.Player);
            case MpTypes.Vehicle:
                return validate('vehicle', mp.vehicles, mp.Vehicle);
        }
    }
    return false;
}
function generateId() {
    const first = (Math.random() * 46656) | 0;
    const second = (Math.random() * 46656) | 0;
    const firstPart = `000${first.toString(36)}`.slice(-3);
    const secondPart = `000${second.toString(36)}`.slice(-3);
    return firstPart + secondPart;
}
function stringifyData(data) {
    const env = getEnvironment();
    return JSON.stringify(data, (_, value) => {
        if (env === 'client' || (env === 'server' && value && typeof value === 'object')) {
            let type;
            if (isObjectMpType(value, MpTypes.Blip))
                type = MpTypes.Blip;
            else if (isObjectMpType(value, MpTypes.Checkpoint))
                type = MpTypes.Checkpoint;
            else if (isObjectMpType(value, MpTypes.Colshape))
                type = MpTypes.Colshape;
            else if (isObjectMpType(value, MpTypes.Marker))
                type = MpTypes.Marker;
            else if (isObjectMpType(value, MpTypes.Object))
                type = MpTypes.Object;
            else if (isObjectMpType(value, MpTypes.Pickup))
                type = MpTypes.Pickup;
            else if (isObjectMpType(value, MpTypes.Player))
                type = MpTypes.Player;
            else if (isObjectMpType(value, MpTypes.Vehicle))
                type = MpTypes.Vehicle;
            if (type)
                return {
                    __t: type,
                    i: typeof value.remoteId === 'number' ? value.remoteId : value.id
                };
        }
        return value;
    });
}
function parseData(data) {
    const env = getEnvironment();
    return JSON.parse(data, (_, value) => {
        if ((env === 'client' || env === 'server') &&
            value &&
            typeof value === 'object' &&
            typeof value.__t === 'string' &&
            typeof value.i === 'number' &&
            Object.keys(value).length === 2) {
            const id = value.i;
            const type = value.__t;
            let collection;
            switch (type) {
                case MpTypes.Blip:
                    collection = mp.blips;
                    break;
                case MpTypes.Checkpoint:
                    collection = mp.checkpoints;
                    break;
                case MpTypes.Colshape:
                    collection = mp.colshapes;
                    break;
                case MpTypes.Label:
                    collection = mp.labels;
                    break;
                case MpTypes.Marker:
                    collection = mp.markers;
                    break;
                case MpTypes.Object:
                    collection = mp.objects;
                    break;
                case MpTypes.Pickup:
                    collection = mp.pickups;
                    break;
                case MpTypes.Player:
                    collection = mp.players;
                    break;
                case MpTypes.Vehicle:
                    collection = mp.vehicles;
                    break;
            }
            if (collection) {
                return collection[env === 'client' ? 'atRemoteId' : 'at'](id);
            }
        }
        return value;
    });
}
function promiseTimeout(promise, timeout) {
    if (typeof timeout === 'number') {
        return Promise.race([
            new Promise((_, reject) => {
                setTimeout(() => reject('TIMEOUT'), timeout);
            }),
            promise
        ]);
    }
    return promise;
}
function isBrowserValid(browser) {
    try {
        browser.url;
    }
    catch (e) {
        return false;
    }
    return true;
}
function chunkSubstr(str, size) {
    const numChunks = Math.ceil(str.length / size);
    const chunks = new Array(numChunks);
    let index = 0;
    for (let i = 0; i < numChunks; i += 1) {
        chunks[i] = str.substring(index, size);
        index += size;
    }
    return chunks;
}

const ERR_NOT_FOUND = 'PROCEDURE_NOT_FOUND';
const MAX_DATA_SIZE = 32000;
const IDENTIFIER = '__rpc:id';
const PROCESS_EVENT = '__rpc:process';
const PROCESS_EVENT_PARTIAL = '__rpc:processPartial';
const BROWSER_REGISTER = '__rpc:browserRegister';
const BROWSER_UNREGISTER = '__rpc:browserUnregister';
const TRIGGER_EVENT = '__rpc:triggerEvent';
const TRIGGER_EVENT_BROWSERS = '__rpc:triggerEventBrowsers';
const environment = getEnvironment();
const glob = environment === 'cef' ? window : global;
if (!glob[PROCESS_EVENT_PARTIAL]) {
    glob.__rpcPartialData = {};
    glob[PROCESS_EVENT_PARTIAL] = (player, id, index, size, rawData) => {
        if (environment !== 'server') {
            rawData = size;
            size = index;
            index = id;
            id = player;
        }
        if (!glob.__rpcPartialData[id]) {
            glob.__rpcPartialData[id] = new Array(size);
        }
        glob.__rpcPartialData[id][index] = rawData;
        if (!glob.__rpcPartialData[id].includes(undefined)) {
            if (environment === 'server') {
                glob[PROCESS_EVENT](player, glob.__rpcPartialData[id].join(''));
            }
            else {
                glob[PROCESS_EVENT](glob.__rpcPartialData[id].join(''));
            }
            delete glob.__rpcPartialData[id];
        }
    };
}
if (!glob[PROCESS_EVENT]) {
    glob.__rpcListeners = {};
    glob.__rpcPending = {};
    glob.__rpcEvListeners = {};
    glob[PROCESS_EVENT] = (player, rawData) => {
        if (environment !== 'server') {
            rawData = player;
        }
        const data = parseData(rawData);
        if (data.req) {
            // someone is trying to remotely call a procedure
            const info = {
                id: data.id,
                environment: data.fenv || data.env
            };
            if (environment === 'server') {
                info.player = player;
            }
            const part = {
                ret: 1,
                id: data.id,
                env: environment
            };
            let ret;
            switch (environment) {
                case 'server': {
                    ret = (ev) => info.player.call(PROCESS_EVENT, [stringifyData(ev)]);
                    break;
                }
                case 'client': {
                    if (data.env === 'server') {
                        ret = (ev) => mp.events.callRemote(PROCESS_EVENT, stringifyData(ev));
                    }
                    else if (data.env === 'cef') {
                        const browser = data.b && glob.__rpcBrowsers[data.b];
                        info.browser = browser;
                        ret = (ev) => browser && isBrowserValid(browser) && passEventToBrowser(browser, ev, true);
                    }
                    break;
                }
                // CEF
                default: {
                    ret = (ev) => mp.trigger(PROCESS_EVENT, stringifyData(ev));
                }
            }
            // @ts-ignore meh
            if (ret) {
                const promise = callProcedure(data.name, data.args, info);
                if (!data.noRet) {
                    promise.then((res) => ret({ ...part, res })).catch((err) => ret({ ...part, err: err ? err : null }));
                }
            }
        }
        else if (data.ret) {
            // a previously called remote procedure has returned
            const info = glob.__rpcPending[data.id];
            if (environment === 'server' && info.player !== player) {
                return;
            }
            if (info) {
                info.resolve(data.hasOwnProperty('err') ? Promise.reject(data.err) : Promise.resolve(data.res));
                delete glob.__rpcPending[data.id];
            }
        }
    };
    if (environment === 'cef') {
        if (typeof glob[IDENTIFIER] === 'undefined') {
            glob[IDENTIFIER] = new Promise((resolve) => {
                if (window.name) {
                    resolve(window.name);
                }
                else {
                    glob[`${IDENTIFIER}:resolve`] = resolve;
                }
            });
        }
    }
    else {
        mp.events.add(PROCESS_EVENT, glob[PROCESS_EVENT]);
        mp.events.add(PROCESS_EVENT_PARTIAL, glob[PROCESS_EVENT_PARTIAL]);
        if (environment === 'client') {
            // set up internal pass-through events
            register('__rpc:callServer', ([name, args, noRet], info) => _callServer(name, args, { fenv: info.environment, noRet }));
            register('__rpc:callBrowsers', ([name, args, noRet], info) => _callBrowsers(null, name, args, { fenv: info.environment, noRet }));
            // set up browser identifiers
            glob.__rpcBrowsers = {};
            const initBrowser = (browser) => {
                const id = generateId();
                Object.keys(glob.__rpcBrowsers).forEach((key) => {
                    const b = glob.__rpcBrowsers[key];
                    if (!b || !isBrowserValid(b) || b === browser) {
                        delete glob.__rpcBrowsers[key];
                    }
                });
                glob.__rpcBrowsers[id] = browser;
                browser.execute(`
                    window.name = '${id}';
                    if(typeof window['${IDENTIFIER}'] === 'undefined'){
                        window['${IDENTIFIER}'] = Promise.resolve(window.name);
                    }else{
                        window['${IDENTIFIER}:resolve'](window.name);
                    }
                `);
            };
            mp.browsers.forEach(initBrowser);
            mp.events.add('browserCreated', initBrowser);
            // set up browser registration map
            glob.__rpcBrowserProcedures = {};
            mp.events.add(BROWSER_REGISTER, (data) => {
                const [browserId, name] = JSON.parse(data);
                glob.__rpcBrowserProcedures[name] = browserId;
            });
            mp.events.add(BROWSER_UNREGISTER, (data) => {
                const [browserId, name] = JSON.parse(data);
                if (glob.__rpcBrowserProcedures[name] === browserId) {
                    delete glob.__rpcBrowserProcedures[name];
                }
            });
            register(TRIGGER_EVENT_BROWSERS, ([name, args], info) => {
                Object.keys(glob.__rpcBrowsers).forEach((key) => {
                    const browser = glob.__rpcBrowsers[key];
                    if (!browser || !isBrowserValid(browser)) {
                        // Clean up expired browsers
                        delete glob.__rpcBrowsers[key];
                    }
                    else {
                        void _callBrowser(browser, TRIGGER_EVENT, [name, args], { fenv: info.environment, noRet: 1 });
                    }
                });
            });
        }
    }
    register(TRIGGER_EVENT, ([name, args], info) => callEvent(name, args, info));
}
function passEventToBrowser(browser, data, ignoreNotFound) {
    const raw = stringifyData(data);
    browser.execute(`var process = window["${PROCESS_EVENT}"]; if(process){ process(${JSON.stringify(raw)}); }else{ ${ignoreNotFound ? '' : `mp.trigger("${PROCESS_EVENT}", '{"ret":1,"id":"${data.id}","err":"${ERR_NOT_FOUND}","env":"cef"}');`} }`);
}
function callProcedure(name, args, info) {
    const listener = glob.__rpcListeners[name];
    if (!listener) {
        return Promise.reject(`${ERR_NOT_FOUND} (${name})`);
    }
    return Promise.resolve(listener(args, info));
}
function sendEventData(event, player) {
    const callEnvFunc = {
        client: (event, ...args) => mp.events.callRemote(event, ...args),
        server: (event, ...args) => player.call(event, [...args])
    };
    const env = event.env;
    const sendString = stringifyData(event);
    if (sendString.length > MAX_DATA_SIZE) {
        const parts = chunkSubstr(sendString, MAX_DATA_SIZE);
        parts.forEach((partString, index) => {
            callEnvFunc[env](PROCESS_EVENT_PARTIAL, event.id, index, parts.length, partString);
        });
    }
    else {
        callEnvFunc[env](PROCESS_EVENT, sendString);
    }
}
/**
 * Register a procedure.
 * @param {string} name - The name of the procedure.
 * @param {ProcedureListener} cb - The procedure's callback. The return value will be sent back to the caller.
 * @returns The function, which unregister the event.
 */
function register(name, cb) {
    if (arguments.length !== 2) {
        throw new Error(`register expects 2 arguments: "name" and "cb" ("${name}")`);
    }
    log(`Registered procedure "${name}"`);
    if (environment === 'cef') {
        glob[IDENTIFIER].then((id) => mp.trigger(BROWSER_REGISTER, JSON.stringify([id, name])));
    }
    glob.__rpcListeners[name] = cb;
    return () => unregister(name);
}
/**
 * Unregister a procedure.
 * @param {string} name - The name of the procedure.
 */
function unregister(name) {
    if (arguments.length !== 1) {
        throw new Error(`unregister expects 1 argument: "name" ("${name}")`);
    }
    log(`Unregistered procedure "${name}"`);
    if (environment === 'cef') {
        glob[IDENTIFIER].then((id) => mp.trigger(BROWSER_UNREGISTER, JSON.stringify([id, name])));
    }
    glob.__rpcListeners[name] = undefined;
}
/**
 * Calls a local procedure. Only procedures registered in the same context will be resolved.
 *
 * Can be called from any environment.
 *
 * @param name - The name of the locally registered procedure.
 * @param args - Any parameters for the procedure.
 * @param options - Any options.
 * @returns The result from the procedure.
 */
function call(name, args, options = {}) {
    if (arguments.length < 1 || arguments.length > 3) {
        return Promise.reject(`call expects 1 to 3 arguments: "name", optional "args", and optional "options" ("${name}")`);
    }
    return promiseTimeout(callProcedure(name, args, { environment }), options.timeout);
}
function _callServer(name, args, extraData = {}) {
    switch (environment) {
        case 'server':
            return call(name, args);
        case 'client': {
            const id = generateId();
            return new Promise((resolve) => {
                if (!extraData.noRet) {
                    glob.__rpcPending[id] = {
                        resolve
                    };
                }
                const event = {
                    req: 1,
                    id,
                    name,
                    env: environment,
                    args,
                    ...extraData
                };
                sendEventData(event);
            });
        }
        case 'cef':
            return callClient('__rpc:callServer', [name, args, Number(extraData.noRet)]);
    }
}
/**
 * Calls a remote procedure registered on the server.
 *
 * Can be called from any environment.
 *
 * @param name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @param options - Any options.
 * @returns The result from the procedure.
 */
function callServer(name, args, options = {}) {
    if (arguments.length < 1 || arguments.length > 3) {
        return Promise.reject(`callServer expects 1 to 3 arguments: "name", optional "args", and optional "options" ("${name}")`);
    }
    const extraData = {};
    if (options.noRet) {
        extraData.noRet = 1;
    }
    return promiseTimeout(_callServer(name, args, extraData), options.timeout);
}
function _callClient(player, name, args, extraData = {}) {
    switch (environment) {
        case 'client':
            return call(name, args);
        case 'server': {
            const id = generateId();
            return new Promise((resolve) => {
                if (!extraData.noRet) {
                    glob.__rpcPending[id] = {
                        resolve,
                        player
                    };
                }
                const event = {
                    req: 1,
                    id,
                    name,
                    env: environment,
                    args,
                    ...extraData
                };
                sendEventData(event, player);
            });
        }
        case 'cef': {
            const id = generateId();
            return glob[IDENTIFIER].then((browserId) => {
                return new Promise((resolve) => {
                    if (!extraData.noRet) {
                        glob.__rpcPending[id] = {
                            resolve
                        };
                    }
                    const event = {
                        b: browserId,
                        req: 1,
                        id,
                        name,
                        env: environment,
                        args,
                        ...extraData
                    };
                    mp.trigger(PROCESS_EVENT, stringifyData(event));
                });
            });
        }
    }
}
/**
 * Calls a remote procedure registered on the client.
 *
 * Can be called from any environment.
 *
 * @param player - The player to call the procedure on.
 * @param name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @param options - Any options.
 * @returns The result from the procedure.
 */
function callClient(player, name, args, options = {}) {
    switch (environment) {
        case 'client': {
            options = args || {};
            args = name;
            name = player;
            player = null;
            if (arguments.length < 1 || arguments.length > 3 || typeof name !== 'string') {
                return Promise.reject(`callClient from the client expects 1 to 3 arguments: "name", optional "args", and optional "options" ("${name}")`);
            }
            break;
        }
        case 'server': {
            if (arguments.length < 2 || arguments.length > 4 || typeof player !== 'object') {
                return Promise.reject(`callClient from the server expects 2 to 4 arguments: "player", "name", optional "args", and optional "options" ("${name}")`);
            }
            break;
        }
        case 'cef': {
            options = args || {};
            args = name;
            name = player;
            player = null;
            if (arguments.length < 1 || arguments.length > 3 || typeof name !== 'string') {
                return Promise.reject(`callClient from the browser expects 1 to 3 arguments: "name", optional "args", and optional "options" ("${name}")`);
            }
            break;
        }
    }
    const extraData = {};
    if (options.noRet) {
        extraData.noRet = 1;
    }
    return promiseTimeout(_callClient(player, name, args, extraData), options.timeout);
}
function _callBrowser(browser, name, args, extraData = {}) {
    return new Promise((resolve) => {
        const id = generateId();
        if (!extraData.noRet) {
            glob.__rpcPending[id] = {
                resolve
            };
        }
        passEventToBrowser(browser, {
            req: 1,
            id,
            name,
            env: environment,
            args,
            ...extraData
        }, false);
    });
}
function _callBrowsers(player, name, args, extraData = {}) {
    switch (environment) {
        case 'client': {
            const browserId = glob.__rpcBrowserProcedures[name];
            if (!browserId) {
                return Promise.reject(`${ERR_NOT_FOUND} (${name})`);
            }
            const browser = glob.__rpcBrowsers[browserId];
            if (!browser || !isBrowserValid(browser)) {
                return Promise.reject(`${ERR_NOT_FOUND} (${name})`);
            }
            return _callBrowser(browser, name, args, extraData);
        }
        case 'server':
            return _callClient(player, '__rpc:callBrowsers', [name, args, Number(extraData.noRet)], extraData);
        case 'cef':
            return _callClient(null, '__rpc:callBrowsers', [name, args, Number(extraData.noRet)], extraData);
    }
}
/**
 * Calls a remote procedure registered in any browser context.
 *
 * Can be called from any environment.
 *
 * @param player - The player to call the procedure on.
 * @param name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @param options - Any options.
 * @returns The result from the procedure.
 */
function callBrowsers(player, name, args, options = {}) {
    let promise;
    const extraData = {};
    switch (environment) {
        case 'client':
        case 'cef': {
            options = args || {};
            args = name;
            name = player;
            if (arguments.length < 1 || arguments.length > 3) {
                return Promise.reject(`callBrowsers from the client or browser expects 1 to 3 arguments: "name", optional "args", and optional "options" ("${name}")`);
            }
            if (options.noRet) {
                extraData.noRet = 1;
            }
            promise = _callBrowsers(null, name, args, extraData);
            break;
        }
        case 'server':
            if (arguments.length < 2 || arguments.length > 4) {
                return Promise.reject(`callBrowsers from the server expects 2 to 4 arguments: "player", "name", optional "args", and optional "options" ("${name}")`);
            }
            if (options.noRet) {
                extraData.noRet = 1;
            }
            promise = _callBrowsers(player, name, args, extraData);
            break;
    }
    if (promise) {
        return promiseTimeout(promise, options.timeout);
    }
    return undefined;
}
/**
 * Calls a remote procedure registered in a specific browser instance.
 *
 * Client-side environment only.
 *
 * @param browser - The browser instance.
 * @param name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @param options - Any options.
 * @returns The result from the procedure.
 */
function callBrowser(browser, name, args, options = {}) {
    if (environment !== 'client') {
        return Promise.reject(`callBrowser can only be used in the client environment ("${name}")`);
    }
    if (arguments.length < 2 || arguments.length > 4)
        return Promise.reject(`callBrowser expects 2 to 4 arguments: "browser", "name", optional "args", and optional "options" ("${name}")`);
    const extraData = {};
    if (options.noRet) {
        extraData.noRet = 1;
    }
    return promiseTimeout(_callBrowser(browser, name, args, extraData), options.timeout);
}
function callEvent(name, args, info) {
    const listeners = glob.__rpcEvListeners[name];
    if (listeners) {
        listeners.forEach((listener) => listener(args, info));
    }
}
/**
 * Register an event handler.
 * @param {string} name - The name of the event.
 * @param {ProcedureListener} cb - The callback for the event.
 * @returns The function, which off the event.
 */
function on(name, cb) {
    if (arguments.length !== 2) {
        throw new Error(`on expects 2 arguments: "name" and "cb" ("${name}")`);
    }
    log(`Registered procedure listener "${name}"`);
    const listeners = glob.__rpcEvListeners[name] || new Set();
    listeners.add(cb);
    glob.__rpcEvListeners[name] = listeners;
    return () => off(name, cb);
}
/**
 * Unregister an event handler.
 * @param {string} name - The name of the event.
 * @param {ProcedureListener} cb - The callback for the event.
 */
function off(name, cb) {
    if (arguments.length !== 2) {
        throw new Error(`off expects 2 arguments: "name" and "cb" ("${name}")`);
    }
    const listeners = glob.__rpcEvListeners[name];
    if (listeners) {
        log(`Unregistered procedure listener "${name}"`);
        listeners.delete(cb);
    }
}
/**
 * Triggers a local event. Only events registered in the same context will be triggered.
 *
 * Can be called from any environment.
 *
 * @param name - The name of the locally registered event.
 * @param args - Any parameters for the event.
 */
function trigger(name, args) {
    if (arguments.length < 1 || arguments.length > 2) {
        throw new Error(`trigger expects 1 or 2 arguments: "name", and optional "args" ("${name}")`);
    }
    callEvent(name, args, { environment });
}
/**
 * Triggers an event registered on the client.
 *
 * Can be called from any environment.
 *
 * @param player - The player to call the procedure on.
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
function triggerClient(player, name, args) {
    switch (environment) {
        case 'client': {
            args = name;
            name = player;
            player = null;
            if (arguments.length < 1 || arguments.length > 2 || typeof name !== 'string') {
                throw new Error(`triggerClient from the client expects 1 or 2 arguments: "name", and optional "args" ("${name}")`);
            }
            break;
        }
        case 'server': {
            if (arguments.length < 2 || arguments.length > 3 || typeof player !== 'object') {
                throw new Error(`triggerClient from the server expects 2 or 3 arguments: "player", "name", and optional "args" ("${name}")`);
            }
            break;
        }
        case 'cef': {
            args = name;
            name = player;
            player = null;
            if (arguments.length < 1 || arguments.length > 2 || typeof name !== 'string') {
                throw new Error(`triggerClient from the browser expects 1 or 2 arguments: "name", and optional "args" ("${name}")`);
            }
            break;
        }
    }
    void _callClient(player, TRIGGER_EVENT, [name, args], { noRet: 1 });
}
/**
 * Triggers an event registered on the server.
 *
 * Can be called from any environment.
 *
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
function triggerServer(name, args) {
    if (arguments.length < 1 || arguments.length > 2) {
        throw new Error(`triggerServer expects 1 or 2 arguments: "name", and optional "args" ("${name}")`);
    }
    void _callServer(TRIGGER_EVENT, [name, args], { noRet: 1 });
}
/**
 * Triggers an event registered in any browser context.
 *
 * Can be called from any environment.
 *
 * @param player - The player to call the procedure on.
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
function triggerBrowsers(player, name, args) {
    switch (environment) {
        case 'client':
        case 'cef': {
            args = name;
            name = player;
            player = null;
            if (arguments.length < 1 || arguments.length > 2) {
                throw new Error(`triggerBrowsers from the client or browser expects 1 or 2 arguments: "name", and optional "args" ("${name}")`);
            }
            break;
        }
        case 'server': {
            if (arguments.length < 2 || arguments.length > 3) {
                throw new Error(`triggerBrowsers from the server expects 2 or 3 arguments: "player", "name", and optional "args" ("${name}")`);
            }
            break;
        }
    }
    void _callClient(player, TRIGGER_EVENT_BROWSERS, [name, args], { noRet: 1 });
}
/**
 * Triggers an event registered in a specific browser instance.
 *
 * Client-side environment only.
 *
 * @param browser - The browser instance.
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
function triggerBrowser(browser, name, args) {
    if (environment !== 'client') {
        throw new Error(`callBrowser can only be used in the client environment ("${name}")`);
    }
    if (arguments.length < 2 || arguments.length > 4) {
        throw new Error(`callBrowser expects 2 or 3 arguments: "browser", "name", and optional "args" ("${name}")`);
    }
    void _callBrowser(browser, TRIGGER_EVENT, [name, args], { noRet: 1 });
}
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const version = '0.2.1';

exports.call = call;
exports.callBrowser = callBrowser;
exports.callBrowsers = callBrowsers;
exports.callClient = callClient;
exports.callServer = callServer;
exports.off = off;
exports.on = on;
exports.register = register;
exports.setDebugMode = setDebugMode;
exports.trigger = trigger;
exports.triggerBrowser = triggerBrowser;
exports.triggerBrowsers = triggerBrowsers;
exports.triggerClient = triggerClient;
exports.triggerServer = triggerServer;
exports.unregister = unregister;
exports.version = version;
