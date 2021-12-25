declare interface Browser {
	url: string;
	execute: (code: string) => void;
	[property: string]: any;
}

declare interface Player {
	call: (eventName: string, args?: any[]) => void;
	[property: string]: any;
}

export declare type ProcedureListener = (args: any, info: ProcedureListenerInfo) => any;

export declare interface ProcedureListenerInfo<T = any, K = any> {
	environment: string;
	id?: string;
	player?: T;
	browser?: K;
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
export declare function call<T = any>(name: string, args?: any, options?: CallOptions): Promise<T>;

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
export declare function callBrowser<T = any>(browser: Browser, name: string, args?: any, options?: CallOptions): Promise<T>;

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
export declare function callBrowsers<T = any>(name: string, args?: any, options?: CallOptions): Promise<T> | undefined;
export declare function callBrowsers<T = any>(player: Player, name: string, args?: any, options?: CallOptions): Promise<T> | undefined;

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
export declare function callClient<T = any>(name: string, args?: any, options?: CallOptions): Promise<T>;
export declare function callClient<T = any>(player: Player, name: string, args?: any, options?: CallOptions): Promise<T>;

export declare interface CallOptions {
	timeout?: number;
	noRet?: boolean;
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
export declare function callServer<T = any>(name: string, args?: any, options?: CallOptions): Promise<T>;

/**
 * Unregister an event handler.
 * @param {string} name - The name of the event.
 * @param {ProcedureListener} cb - The callback for the event.
 */
export declare function off(name: string, cb: ProcedureListener): void;

/**
 * Register an event handler.
 * @param {string} name - The name of the event.
 * @param {ProcedureListener} cb - The callback for the event.
 * @returns The function, which off the event.
 */
export declare function on(name: string, cb: ProcedureListener): () => void;

/**
 * Register a procedure.
 * @param {string} name - The name of the procedure.
 * @param {ProcedureListener} cb - The procedure's callback. The return value will be sent back to the caller.
 * @returns The function, which unregister the event.
 */
export declare function register(name: string, cb: ProcedureListener): () => void;

export declare function setDebugMode(state: boolean): void;

/**
 * Triggers a local event. Only events registered in the same context will be triggered.
 *
 * Can be called from any environment.
 *
 * @param name - The name of the locally registered event.
 * @param args - Any parameters for the event.
 */
export declare function trigger(name: string, args?: any): void;

/**
 * Triggers an event registered in a specific browser instance.
 *
 * Client-side environment only.
 *
 * @param browser - The browser instance.
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
export declare function triggerBrowser(browser: Browser, name: string, args?: any): void;

/**
 * Triggers an event registered in any browser context.
 *
 * Can be called from any environment.
 *
 * @param player - The player to call the procedure on.
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
export declare function triggerBrowsers(name: string, args?: any): void;
export declare function triggerBrowsers(player: Player, name: string, args?: any): void;

/**
 * Triggers an event registered on the client.
 *
 * Can be called from any environment.
 *
 * @param player - The player to call the procedure on.
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
export declare function triggerClient(name: string, args?: any): void;
export declare function triggerClient(player: Player, name: string, args?: any): void;

/**
 * Triggers an event registered on the server.
 *
 * Can be called from any environment.
 *
 * @param name - The name of the event.
 * @param args - Any parameters for the event.
 */
export declare function triggerServer(name: string, args?: any): void;

/**
 * Unregister a procedure.
 * @param {string} name - The name of the procedure.
 */
export declare function unregister(name: string): void;

export declare const version: string;

export {};
