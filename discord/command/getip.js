module.exports = (command, args) => {
	if (args.length === 1) {
		let ip = args[0].replace(/\./g, "_");
		if (!ip.includes(":")) {
			ip += "_25565";
		} else {
			ip = ip.replace(":", "_");
		}
		ip += ".proxy.hpf.fun:25501";
		command.reply(ip);
	}
}