const FlakeId = require("flakeid");
const flake = new FlakeId.default();
const self = module.exports = {
	array: [],
	push: (item) => {
		const id = flake.gen();
		self.array.push({
			id: id,
			packet: {
				side: item.side,
				state: item.state,
				data: item.data
			}
		});
		return id;
	},
	remove: (id) => {
		self.array.some((item) => {
			if (item.id == id) {
				self.array.splice(self.array.indexOf(item), 1);
				return true;
			}
			return false;
		});
	},
	run: (connection, packetHandler) => {
		console.log("queue");
		self.array.forEach((packet) => {
			self.array.splice(self.array.indexOf(packet), 1);
			console.log(packet);
			const flushed = connection.socket.remote.write(packet.packet.data);
			if (!flushed) {
				connection.socket.remote.pause();
			}
			console.log("sent packet");
			packetHandler(connection, packet.packet.data, packet.packet.side);
		});
	}
};