const varint = require("varint");
const dns = require("dns-then");
const app = require("^app.js");
const pinger = require("minecraft-pinger")

module.exports = {
	handle: (packet) => {
		//packet.utils.printBytes(packet.data);
		let offset = 0;
		packet.ver = varint.decode(packet.data, offset);
		offset += varint.encodingLength(packet.ver);
		packet.address = packet.utils.string.decode(offset).toString("utf8");
		offset += Buffer.byteLength(packet.address) + 1;
		packet.port = packet.data.readUInt16BE(offset);
		offset += 2;
		packet.connection.state = varint.decode(packet.data, offset) === 1 ? "status" : "login";
		packet.connection.version = packet.ver;
		let ip = packet.address.split(".")[0];
		ip = [
			ip.substr(0, ip.lastIndexOf("_")).replace(/_/g, "."),
			parseInt(ip.substr(ip.lastIndexOf("_") + 1))
		];
		const origip = [ip[0], ip[1]];
		(async () => {
			try {
				const addresses = await dns.resolveSrv("_minecraft._tcp." + ip[0]);
				connect(addresses);
			} catch (ignored) {
				connect([]);
			}
		})();

		async function connect(addresses) {
			if (addresses.length > 0) {
				ip[0] = addresses[0].name;
				ip[1] = addresses[0].port;
			}
			try {
				const addresses = await dns.resolve4(ip[0]);
				ip[0] = addresses[0];
			} catch (ignored) {}
			console.log("connecting with %s:%d", origip[0], origip[1]);
			let fallback = false;
			const fwdp = async (socket) => {
				console.log(`Sending ${packet.connection.queued+1} queued packets.`)
				packet.connection.queued.forEach((p, i) => {
					setTimeout(() => {
						packet.connection.queued.splice(i, 1);
						let modified = false;
						if (!p[3]) {
							modified = app.handlePacket(p[0], p[1], p[2]);
						}
						if (modified) {
							p[1] = modified;
						}
						socket.write(p[1]);
					}, 100 * i);
				});

				packet.connection.address = {
					host: ip[0],
					port: ip[1]
				};
				packet.connection.addressInitial = {
					host: origip[0],
					port: origip[1]
				};
				try {
					packet.connection.ping = await pinger.pingPromise(ip[0], ip[1]);
				} catch (ignored) {}
				if (!socket.destroyed && !fallback) {
					app.events.emit("connect", packet.connection);
				}
			};
			packet.connection.socket.remote.connect(ip[0], ip[1]);

			packet.connection.socket.remote.once("connect", () => {
				console.log("Connected");
				setTimeout(fwdp, 150, packet.connection.socket.remote);
			});

			packet.connection.socket.remote.setTimeout(1500);
			packet.connection.socket.remote.once("error", () => {
				console.log("Using fallback server.");
				packet.connection.socket.fallback.connect(25567, "node1.hpf.fun", () => {
					console.log("Fallback server socket connected.");
				});
				setTimeout(fwdp, 250, packet.connection.socket.fallback);
			})
		}
	}
}