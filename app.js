const net = require("net");
const events = require("./events.js");
require("rooty")();
const packets = require("./handlers/packets.js");
const varint = require("varint");
const proxysocket = require("proxysocket");
const fs = require("fs");
const uuid = require("uuid/v4");
module.exports.events = events;
const dev = process.argv.length <= 4 ? process.argv[3] === "dev" ? true : false : false;
require("colors");
require("./discord/lilydiscord.js");

if (process.argv.length < 3) {
	console.log("usage: %s <localport>", process.argv[1]);
	process.exit();
}

loadProxies().then((proxies) => {
	console.log("Loading LilyProxy. Proxies: " + proxies.length);
	const localport = process.argv[2];

	const fallbackServer = new net.Socket();
	fallbackServer.connect(25567, "node1.hpf.fun", () => {
		console.log("Fallback server socket connected.");
	});

	const server = net.createServer((localsocket) => {
		let randomProxy = getProxy();
		randomProxy = randomProxy.split(":");
		randomProxy[1] = parseInt(randomProxy[1]);
		const connection = {
			socket: {
				remote: proxysocket.create(randomProxy[0], randomProxy[1], new net.Socket()),
				local: localsocket
			},
			queued: [],
			buffer: {
				remote: Buffer.alloc(0),
				local: Buffer.alloc(0)
			},
			id: uuid()
		};
		events.emit("init", connection);

		connection.socket.local.on("connect", (data) => {
			console.log(">>> connection #%d from %s:%d",
				server.connections,
				connection.socket.local.remoteAddress,
				connection.socket.local.remotePort
			);
		});

		connection.socket.local.on("data", (data) => {
			connection.buffer.local = Buffer.concat([connection.buffer.local, data]);
			const modified = handlePacket(connection, data, "client");
			if (modified) {
				data = modified;
			}
			if (!connection.socket.remote.remoteAddress) {
				connection.queued.push([connection, data, "client", connection.state === "handshaking"]);
			} else {
				const flushed = connection.socket.remote.write(data);
				if (!flushed) {
					connection.socket.local.pause();
				}
			}
		});

		connection.socket.remote.on("data", (data) => {
			connection.buffer.remote = Buffer.concat([connection.buffer.remote, data]);
			const modified = handlePacket(connection, data, "server");
			if (modified) {
				data = modified;
			}
			const flushed = connection.socket.local.write(data);
			if (!flushed) {
				connection.socket.remote.pause();
			}
		});

		connection.socket.local.on("drain", () => {
			connection.socket.remote.resume();
		});

		connection.socket.remote.on("drain", () => {
			connection.socket.local.resume();
		});

		connection.socket.local.on("close", () => {
			connection.socket.remote.end();
		});

		connection.socket.remote.on("close", () => {
			events.emit("close", connection);
			connection.socket.local.end();
		});
	});
	server.listen(localport);
	console.log("Listening on 0.0.0.0:%d", localport);

	module.exports.handlePacket = handlePacket;

	function handlePacket(connection, currentBytes, side) {
		const data = side === "client" ? connection.buffer.local : connection.buffer.remote;
		try {
			if (!connection.hasOwnProperty("state")) connection.state = "handshaking";
			const length = varint.decode(data, 0);
			const id = varint.decode(data, varint.encodingLength(length));
			const content = data.slice(
				varint.encodingLength(length) +
				varint.encodingLength(id)
			);
			if (data.length < varint.encodingLength(length) + length) {
				return; // incomplete packet
			}

			if (packets[side][connection.state].hasOwnProperty(id)) {
				try {
					const result = packets[side][connection.state][id].handler({
						side: side,
						length: length,
						id: id,
						data: content,
						rawpacketdata: data,
						connection: connection,
						utils: {
							string: {
								length: (offset) => {
									const length = varint.decode(content, offset);
									return varint.encodingLength(length) + length;
								},
								decode: (offset) => {
									const length = varint.decode(content, offset);
									return content.slice(
										varint.encodingLength(length) + 1,
										varint.encodingLength(length) + length + 1
									);
								}
							},
							printBytes: (buffer, amount) => {
								amount = amount || buffer.length;
								[...buffer].some((byte, i) => {
									if (i > amount) return true;
									console.log(i + " - " + byte.toString(16) + " - " + String.fromCharCode(byte).red);
									return false;
								});
							}
						}
					});
					if (result) {
						const c = Buffer.concat([Buffer.from(varint.encode(length)), Buffer.from(varint.encode(id)), content]);
						return c;
					}
				} catch (e) {
					logError(new Error("An error occoured while handling a packet with ID " + id + ": " + e.message));
				}
			}

			data.slice(currentBytes);
		} catch (e) {
			if (e.message === "Could not decode varint") return;
			logError(new Error("An error occoured while parsing a packet: " + e.message));
		}
	}

	function getProxy() {
		return proxies[Math.floor(Math.random() * proxies.length)];
	}
});

function loadProxies() {
	return new Promise((resolve, reject) => {
		const proxyList = fs.readFileSync("proxies.txt", "utf8").split(/(.+) #.+/g).filter(str => {
			return str !== "\n" &&
				str !== "" &&
				!str.startsWith("#")
		});
		resolve(proxyList);
		/*
		if (!dev) {
			console.log("Proxies");
			const len = proxyList.length;
			let done = false;
			let i = 0;
			const newList = [];
			proxyList.forEach((proxy, index) => {
				proxy = proxy.split(":");
				proxy = {
					ipAddress: proxy[0],
					port: parseInt(proxy[1]),
					protocols: ["SOCKS5", "SOCKS4"]
				};
				const start = Date.now();
				ProxyVerifier.testAll(proxy, (err, result) => {
					proxy.ping = Date.now() - start;
					i++;
					console.log(`  ${proxy.ipAddress}:${proxy.port}`)
					if (err) {
						proxyList.splice(index, 1);
						console.log("    Error");
					} else {
						if (
							result.protocols.hasOwnProperty("SOCKS5") && result.protocols["SOCKS5"].ok ||
							result.protocols.hasOwnProperty("SOCKS4") && result.protocols["SOCKS4"].ok
						) {
							proxy.supported = true;
						}
						if (proxy.supported) {
							newList.push(`${proxy.ipAddress}:${proxy.port}`);
							console.log("    Protocols");
							Object.keys(result.protocols).forEach((protocol) => {
								console.log("      " + capitalizeFirstLetter(protocol.toLowerCase()));
							});
							console.log("    Anonymity level: " + capitalizeFirstLetter(result.anonymityLevel));
						} else {
							proxyList.splice(index, 1);
							console.log("    Unsupported protocol");
						}
						console.log(`    Ping: ${proxy.ping}ms`);
					}
					if (i === len) {
						done = true;
					}
				});
			});

			const resolveChecker = setInterval(() => {
				if (done) {
					clearInterval(resolveChecker);
					resolve(newList);
				}
			}, 100);
		} else {
			resolve(proxyList);
		}
		*/
	});
}

process.on("uncaughtException", (e) => {
	if (e.message === "This socket has been ended by the other party") return;
	if (e.message === "SOCKS connection failed. connection refused by destination host.") return;
	if (e.message === "write after end") return;
	logError(e);
});

function logError(e) {
	console.error(e.stack.toString().red.replace(/(^.+$)/gm, "$1".red).replace(/\((.+)\)/g, "$1".magenta));
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}