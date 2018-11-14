const EventEmitter = require("events");

class LilyEmitter extends EventEmitter {}
const emitter = new LilyEmitter();
module.exports = emitter;
