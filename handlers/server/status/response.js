const varint = require("varint");
const dns = require("dns-then");

module.exports = {
	handle: (packet) => {
		//return packet.data;
	}
}

function md5(text) {
	const crypto = require("crypto");
	return crypto.createHash("md5").update(text).digest("hex");
}