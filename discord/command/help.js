const dcfg = require("^discord/discord.json");

module.exports = (command, args) => {
	let msg = "";
	Object.values(dcfg.commands).forEach((cmdObj) => {
		msg += `**${cmdObj.displayname}** ${cmdObj.description}\n-  __lily.${cmdObj.usage.replace(/{{command}}/g, cmdObj.name)}__\n`;
	});
	command.reply(msg);
}