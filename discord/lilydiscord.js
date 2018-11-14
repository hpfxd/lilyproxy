const app = require("^app.js");
const config = require("^config.json");
const Discord = require("discord.js");
const client = new Discord.Client();
const currentChannels = {
	pre: [],
	ids: {}
};
let guild;
client.on("ready", () => {
	guild = client.guilds.get("512148472204361728");
	console.log(`Logged in as ${client.user.tag}!`);
});

app.events.on("connect", (connection) => {
	if (connection.state === "login" && !currentChannels.pre.includes(connection.id) && !currentChannels.ids[connection.id] && connection.ping) {
		currentChannels.pre.push(connection.id);

		guild.createChannel(`${connection.address.host.replace(/\./g, "-")}-${connection.address.port}`, "text").then((channel) => {
			channel.setParent("512192950210658314");
			const msg = {
				embed: {
					color: 3066993,
					title: "Server Info",
					fields: [{
						name: "IP",
						value: `${connection.address.host}:${connection.address.port}`
					}, {
						name: "Version",
						value: connection.ping.version.name
					}, {
						name: "Players",
						value: `${connection.ping.players.online}/${connection.ping.players.max}`
					}, {
						name: "Description",
						value: parseTextObj(connection.ping.description.extra)
					}]
				}
			};

			if (connection.ping.favicon) {
				const favicon = new Buffer(connection.ping.favicon.replace(/^data:image\/png;base64,/, ""), "base64");
				msg.files = [{
					attachment: favicon,
					name: "favicon.png"
				}];
				msg.embed.image = {
					url: "attachment://favicon.png"
				};
			}
			channel.send(msg).then((message) => {
				message.pin();
			});
			currentChannels.ids[connection.id] = channel.id;
		})
	}
});

app.events.on("close", (connection) => {
	if (connection.state === "login" && currentChannels.pre.includes(connection.id)) {
		currentChannels.pre.slice(currentChannels.pre.indexOf(connection.id), 1);
		guild.channels.get(currentChannels.ids[connection.id]).delete();
		delete currentChannels.ids[connection.id];
	}
});

client.login(config.discord.token);

function parseTextObj(obj) {
	let result = "";
	obj.forEach((t) => {
		result += t.text;
	});
	return result
}