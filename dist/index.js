'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
