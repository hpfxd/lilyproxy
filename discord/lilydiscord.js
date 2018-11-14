const app = require("^app.js");
const discordConfig = require("./discord.json");
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

client.on("message", (message) => {
	if (message.content.startsWith("lily.")) {
		const split = message.content.split(" ");
		const cmd = split[0].replace("lily.", "");
		if (cmd.length > 0) {
			Object.keys(discordConfig.commands).forEach((commandFile) => {
				const commandObj = discordConfig.commands[commandFile];
				if (commandObj.name === cmd.toLowerCase() || commandObj.aliases.includes(cmd.toLowerCase())) {
					const executeCommand = require("./command/" + commandFile);

					executeCommand({
						guild: guild,
						channel: message.channel,
						reply: (text) => {
							message.channel.send({
								embed: {
									color: 3066993,
									title: commandObj.displayname,
									description: text
								}
							});
						}
					}, split.slice(1));
				}
			});
		}
	}
});

app.events.on("connect", (connection) => {
	const channelname = `${connection.addressInitial.host.replace(/\./g, "-")}${connection.addressInitial.port !== 25565 ? `-${connection.addressInitial.port}`: ""}`;
	if (
		connection.state === "login" &&
		!currentChannels.pre.includes(connection.id) &&
		!currentChannels.ids[connection.id] &&
		connection.ping &&
		!client.channels.find(x => x.name === channelname)
	) {
		currentChannels.pre.push(connection.id);
		guild.createChannel(channelname, "text").then((channel) => {
			channel.setParent("512192950210658314");
			const msg = {
				embed: {
					color: 3066993,
					title: "Server Info",
					fields: [{
						name: "IP",
						value: `${connection.addressInitial.host}:${connection.addressInitial.port}\n${connection.addressInitial.host.replace(/\./g, "_")}_${connection.addressInitial.port}.proxy.hpf.fun:25501`
					}, {
						name: "Version",
						value: connection.ping.version.name
					}, {
						name: "Players",
						value: `${connection.ping.players.online}/${connection.ping.players.max}`
					}]
				}
			};

			if (connection.ping.description.extra) {
				msg.embed.fields.push({
					name: "Description",
					value: parseTextObj(connection.ping.description.extra)
				});
			}

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
