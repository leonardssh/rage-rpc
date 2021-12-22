'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function register(args) {
    console.log(...args);
}
function call(args) {
    console.log(...args);
}
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const version = '0.0.1';

exports.call = call;
exports.register = register;
exports.version = version;
