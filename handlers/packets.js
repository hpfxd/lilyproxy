module.exports = {
	client: {
		handshaking: {
			0x00: {
				name: "handshake",
				handler: getHandler("client", "handshaking", "handshake")
			}
		},
		login: {},
		play: {},
		status: {}
	},
	server: {
		handshaking: {},
		login: {},
		play: {},
		status: {
			0x00: {
				name: "response",
				handler: getHandler("server", "status", "response")
			}
		}
	}
};

function getHandler(side, state, packet) {
	return require(`./${side}/${state}/${packet}.js`).handle;
}