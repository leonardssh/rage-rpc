function register(args) {
    console.log(...args);
}
function call(args) {
    console.log(...args);
}
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const version = '0.0.1';

export { call, register, version };
