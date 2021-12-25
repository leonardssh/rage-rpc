import { getEnvironment, isBrowserValid, parseData, stringifyData, generateId, chunkSubstr, promiseTimeout, setDebugMode, log } from './helpers';

export type ProcedureListener = (args: any, info: ProcedureListenerInfo) => any;

export interface ProcedureListenerInfo<T = any, K = any> {
	environment: string;
	id?: string;
	player?: T;
	browser?: K;
}

export interface CallOptions {
	timeout?: number;
	noRet?: boolean;
}

interface Event {
	req?: number;
	ret?: number;
	b?: string;
	id: string;
	name?: string;
	args?: any;
	env: string;
	fenv?: string;
	res?: any;
	err?: any;
	noRet?: number;
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
const glob = environment === 'cef' ? window : (global as any);

if (!glob[PROCESS_EVENT_PARTIAL]) {
	glob.__rpcPartialData = {};

	glob[PROCESS_EVENT_PARTIAL] = (player: Player | string | number, id: number, index: number, size: number | string, rawData?: string) => {
		if (environment !== 'server') {
			rawData = size as string;
			size = index as number;
			index = id as number;
			id = player as number;
		}

		if (!glob.__rpcPartialData[id]) {
			glob.__rpcPartialData[id] = new Array(size);
		}

		glob.__rpcPartialData[id][index] = rawData;

		if (!glob.__rpcPartialData[id].includes(undefined)) {
			if (environment === 'server') {
				glob[PROCESS_EVENT](player, glob.__rpcPartialData[id].join(''));
			} else {
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

	glob[PROCESS_EVENT] = (player: Player | string, rawData?: string) => {
		if (environment !== 'server') {
			rawData = player as string;
		}

		const data: Event = parseData(rawData!);

		if (data.req) {
			// someone is trying to remotely call a procedure
			const info: ProcedureListenerInfo = {
				id: data.id,
				environment: data.fenv || data.env
			};

			if (environment === 'server') {
				info.player = player as Player;
			}

			const part = {
				ret: 1,
				id: data.id,
				env: environment
			};

			let ret: (ev: Event) => void;

			switch (environment) {
				case 'server': {
					ret = (ev) => info.player!.call(PROCESS_EVENT, [stringifyData(ev)]);
					break;
				}

				case 'client': {
					if (data.env === 'server') {
						ret = (ev) => mp.events.callRemote(PROCESS_EVENT, stringifyData(ev));
					} else if (data.env === 'cef') {
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
				const promise = callProcedure(data.name!, data.args, info);

				if (!data.noRet) {
					promise.then((res) => ret({ ...part, res })).catch((err) => ret({ ...part, err: err ? err : null }));
				}
			}
		} else if (data.ret) {
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
				} else {
					glob[`${IDENTIFIER}:resolve`] = resolve;
				}
			});
		}
	} else {
		mp.events.add(PROCESS_EVENT, glob[PROCESS_EVENT]);
		mp.events.add(PROCESS_EVENT_PARTIAL, glob[PROCESS_EVENT_PARTIAL]);

		if (environment === 'client') {
			// set up internal pass-through events
			register('__rpc:callServer', ([name, args, noRet], info) => _callServer(name, args, { fenv: info.environment, noRet }));
			register('__rpc:callBrowsers', ([name, args, noRet], info) =>
				_callBrowsers(null as unknown as Player, name, args, { fenv: info.environment, noRet })
			);

			// set up browser identifiers
			glob.__rpcBrowsers = {};

			const initBrowser = (browser: Browser): void => {
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

			mp.events.add(BROWSER_REGISTER, (data: string) => {
				const [browserId, name] = JSON.parse(data);
				glob.__rpcBrowserProcedures[name] = browserId;
			});

			mp.events.add(BROWSER_UNREGISTER, (data: string) => {
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
					} else {
						void _callBrowser(browser, TRIGGER_EVENT, [name, args], { fenv: info.environment, noRet: 1 });
					}
				});
			});
		}
	}

	register(TRIGGER_EVENT, ([name, args], info) => callEvent(name, args, info));
}

function passEventToBrowser(browser: Browser, data: Event, ignoreNotFound: boolean): void {
	const raw = stringifyData(data);

	browser.execute(
		`var process = window["${PROCESS_EVENT}"]; if(process){ process(${JSON.stringify(raw)}); }else{ ${
			ignoreNotFound ? '' : `mp.trigger("${PROCESS_EVENT}", '{"ret":1,"id":"${data.id}","err":"${ERR_NOT_FOUND}","env":"cef"}');`
		} }`
	);
}

function callProcedure<T = any>(name: string, args: any, info: ProcedureListenerInfo): Promise<T> {
	const listener = glob.__rpcListeners[name];

	if (!listener) {
		return Promise.reject(`${ERR_NOT_FOUND} (${name})`);
	}

	return Promise.resolve(listener(args, info));
}

function sendEventData(event: Event, player?: Player) {
	const callEnvFunc = {
		client: (event: string, ...args: any[]) => mp.events.callRemote(event, ...args),
		server: (event: string, ...args: any[]) => player!.call(event, [...args])
	};

	const env = event.env as keyof typeof callEnvFunc;

	const sendString = stringifyData(event);
	if (sendString.length > MAX_DATA_SIZE) {
		const parts = chunkSubstr(sendString, MAX_DATA_SIZE);

		parts.forEach((partString, index) => {
			callEnvFunc[env](PROCESS_EVENT_PARTIAL, event.id, index, parts.length, partString);
		});
	} else {
		callEnvFunc[env](PROCESS_EVENT, sendString);
	}
}

/**
 * Register a procedure.
 * @param {string} name - The name of the procedure.
 * @param {ProcedureListener} cb - The procedure's callback. The return value will be sent back to the caller.
 * @returns The function, which unregister the event.
 */
export function register(name: string, cb: ProcedureListener) {
	if (typeof name !== 'string' || !cb || typeof cb !== 'function') {
		throw new Error(`register expects 2 arguments: "name" and "cb" - ("${name}")`);
	}

	log(`Registered procedure "${name}"`);

	if (environment === 'cef') {
		glob[IDENTIFIER].then((id: string) => mp.trigger(BROWSER_REGISTER, JSON.stringify([id, name])));
	}

	glob.__rpcListeners[name] = cb;

	return () => unregister(name);
}

/**
 * Unregister a procedure.
 * @param {string} name - The name of the procedure.
 */
export function unregister(name: string) {
	if (typeof name !== 'string') {
		throw new Error(`unregister expects 1 argument: "name" - ("${name}")`);
	}

	log(`Unregistered procedure "${name}"`);

	if (environment === 'cef') {
		glob[IDENTIFIER].then((id: string) => mp.trigger(BROWSER_UNREGISTER, JSON.stringify([id, name])));
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
export function call<T = any>(name: string, args?: any, options: CallOptions = {}): Promise<T> {
	if (typeof name !== 'string') {
		return Promise.reject(`call expects 1 to 3 arguments: "name", optional "args", and optional "options" - ("${name}")`);
	}

	return promiseTimeout(callProcedure(name, args, { environment }), options.timeout);
}

function _callServer<T = any>(name: string, args?: any, extraData: any = {}): Promise<T> {
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

				const event: Event = {
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
export function callServer<T = any>(name: string, args?: any, options: CallOptions = {}): Promise<T> {
	if (typeof name !== 'string') {
		return Promise.reject(`callServer expects 1 to 3 arguments: "name", optional "args", and optional "options" - ("${name}")`);
	}

	const extraData: any = {};

	if (options.noRet) {
		extraData.noRet = 1;
	}

	return promiseTimeout(_callServer(name, args, extraData), options.timeout);
}

function _callClient<T = any>(player: Player, name: string, args?: any, extraData: any = {}): Promise<T> {
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

				const event: Event = {
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

			return glob[IDENTIFIER].then((browserId: string) => {
				return new Promise((resolve) => {
					if (!extraData.noRet) {
						glob.__rpcPending[id] = {
							resolve
						};
					}

					const event: Event = {
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
export function callClient<T = any>(player: Player | string, name?: string | any, args?: any, options: CallOptions = {}): Promise<T> {
	switch (environment) {
		case 'client': {
			options = args || {};
			args = name;
			name = player;

			// @ts-ignore gives access to assign 'null' type
			player = null;

			if (typeof name !== 'string') {
				return Promise.reject(
					`callClient from the client expects 1 to 3 arguments: "name", optional "args", and optional "options" - ("${name}")`
				);
			}

			break;
		}

		case 'server': {
			if (typeof name !== 'string' || typeof player !== 'object') {
				return Promise.reject(
					`callClient from the server expects 2 to 4 arguments: "player", "name", optional "args", and optional "options" - ("${name}")`
				);
			}

			break;
		}

		case 'cef': {
			options = args || {};
			args = name;
			name = player;

			// @ts-ignore gives access to assign 'null' type
			player = null;

			if (typeof name !== 'string') {
				return Promise.reject(
					`callClient from the browser expects 1 to 3 arguments: "name", optional "args", and optional "options" - ("${name}")`
				);
			}

			break;
		}
	}

	const extraData: any = {};

	if (options.noRet) {
		extraData.noRet = 1;
	}

	return promiseTimeout(_callClient(player as Player, name, args, extraData), options.timeout);
}

function _callBrowser<T = any>(browser: Browser, name: string, args?: any, extraData: any = {}): Promise<T> {
	return new Promise((resolve) => {
		const id = generateId();

		if (!extraData.noRet) {
			glob.__rpcPending[id] = {
				resolve
			};
		}

		passEventToBrowser(
			browser,
			{
				req: 1,
				id,
				name,
				env: environment,
				args,
				...extraData
			},
			false
		);
	});
}

function _callBrowsers<T = any>(player: Player, name: string, args?: any, extraData: any = {}): Promise<T> {
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
			return _callClient(null as unknown as Player, '__rpc:callBrowsers', [name, args, Number(extraData.noRet)], extraData);
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
export function callBrowsers<T = any>(player: Player | string, name?: string | any, args?: any, options: CallOptions = {}): Promise<T> | undefined {
	let promise;
	const extraData: any = {};

	switch (environment) {
		case 'client':
		case 'cef': {
			options = args || {};
			args = name;
			name = player;

			if (typeof name !== 'string') {
				return Promise.reject(
					`callBrowsers from the client or browser expects 1 to 3 arguments: "name", optional "args", and optional "options" - ("${name}")`
				);
			}

			if (options.noRet) {
				extraData.noRet = 1;
			}

			promise = _callBrowsers(null as unknown as Player, name, args, extraData);
			break;
		}

		case 'server':
			if (typeof name !== 'string' || typeof player !== 'object') {
				return Promise.reject(
					`callBrowsers from the server expects 2 to 4 arguments: "player", "name", optional "args", and optional "options" - ("${name}")`
				);
			}

			if (options.noRet) {
				extraData.noRet = 1;
			}

			promise = _callBrowsers(player as Player, name, args, extraData);
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
export function callBrowser<T = any>(browser: Browser, name: string, args?: any, options: CallOptions = {}): Promise<T> {
	if (environment !== 'client') {
		return Promise.reject(`callBrowser can only be used in the client environment - ("${name}")`);
	}

	if (!isBrowserValid(browser) || typeof name !== 'string') {
		return Promise.reject(`callBrowser expects 2 to 4 arguments: "browser", "name", optional "args", and optional "options" - ("${name}")`);
	}

	const extraData: any = {};

	if (options.noRet) {
		extraData.noRet = 1;
	}

	return promiseTimeout(_callBrowser(browser, name, args, extraData), options.timeout);
}

function callEvent(name: string, args: any, info: ProcedureListenerInfo) {
	const listeners = glob.__rpcEvListeners[name];
	if (listeners) {
		listeners.forEach((listener: any) => listener(args, info));
	}
}

/**
 * Register an event handler.
 * @param {string} name - The name of the event.
 * @param {ProcedureListener} cb - The callback for the event.
 * @returns The function, which off the event.
 */
export function on(name: string, cb: ProcedureListener) {
	if (typeof name !== 'string' || !cb || typeof cb !== 'function') {
		throw new Error(`on expects 2 arguments: "name" and "cb" - ("${name}")`);
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
export function off(name: string, cb: ProcedureListener) {
	if (typeof name !== 'string' || !cb || typeof cb !== 'function') {
		throw new Error(`off expects 2 arguments: "name" and "cb" - ("${name}")`);
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
export function trigger(name: string, args?: any) {
	if (typeof name !== 'string') {
		throw new Error(`trigger expects 1 or 2 arguments: "name", and optional "args" - ("${name}")`);
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
export function triggerClient(player: Player | string, name?: string | any, args?: any) {
	switch (environment) {
		case 'client': {
			args = name;
			name = player;

			// @ts-ignore gives access to assign 'null' type
			player = null;

			if (typeof name !== 'string') {
				throw new Error(`triggerClient from the client expects 1 or 2 arguments: "name", and optional "args" - ("${name}")`);
			}

			break;
		}

		case 'server': {
			if (typeof name !== 'string' || typeof player !== 'object') {
				throw new Error(`triggerClient from the server expects 2 or 3 arguments: "player", "name", and optional "args" - ("${name}")`);
			}

			break;
		}

		case 'cef': {
			args = name;
			name = player;

			// @ts-ignore gives access to assign 'null' type
			player = null;

			if (typeof name !== 'string') {
				throw new Error(`triggerClient from the browser expects 1 or 2 arguments: "name", and optional "args" - ("${name}")`);
			}

			break;
		}
	}

	void _callClient(player as Player, TRIGGER_EVENT, [name, args], { noRet: 1 });
}

/**
 * Triggers an event registered on the server.
 *
 * Can be called from any environment.
 *
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
export function triggerServer(name: string, args?: any) {
	if (typeof name !== 'string') {
		throw new Error(`triggerServer expects 1 or 2 arguments: "name", and optional "args" - ("${name}")`);
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
export function triggerBrowsers(player: Player | string, name?: string | any, args?: any) {
	switch (environment) {
		case 'client':
		case 'cef': {
			args = name;
			name = player;

			// @ts-ignore gives access to assign 'null' type
			player = null;

			if (typeof name !== 'string') {
				throw new Error(`triggerBrowsers from the client or browser expects 1 or 2 arguments: "name", and optional "args" - ("${name}")`);
			}

			break;
		}

		case 'server': {
			if (typeof name !== 'string' || typeof player !== 'object') {
				throw new Error(`triggerBrowsers from the server expects 2 or 3 arguments: "player", "name", and optional "args" - ("${name}")`);
			}

			break;
		}
	}

	void _callClient(player as Player, TRIGGER_EVENT_BROWSERS, [name, args], { noRet: 1 });
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
export function triggerBrowser(browser: Browser, name: string, args?: any) {
	if (environment !== 'client') {
		throw new Error(`callBrowser can only be used in the client environment - ("${name}")`);
	}

	if (!isBrowserValid(browser) || typeof name !== 'string') {
		throw new Error(`callBrowser expects 2 or 3 arguments: "browser", "name", and optional "args" - ("${name}")`);
	}

	void _callBrowser(browser, TRIGGER_EVENT, [name, args], { noRet: 1 });
}

export { setDebugMode };

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{version}[/VI]';
