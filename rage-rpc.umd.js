(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.rpc = {}));
})(this, (function (exports) { 'use strict';

	function register(args) {
	    console.log(...args);
	}
	function call(args) {
	    console.log(...args);
	}
	const version = '0.0.1';

	exports.call = call;
	exports.register = register;
	exports.version = version;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
