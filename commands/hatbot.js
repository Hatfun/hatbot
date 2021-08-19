const Discord = require('discord.js-light');
const fs = require('fs');
const v8 = require('v8');

module.exports = {
    name: 'hatbot',
    description: 'Administration of Hatbot',
    async execute(message, args) {
        const cache = message.client.getCache('global');
        const PREFIX = await message.client.getPrefix(message.guild.id);

        async function help(title, content) {
            const embed = new Discord.MessageEmbed()
                .setColor('#fff999')
                .setTitle(`💡 ${title}`)
                .setDescription(content);
            await message.channel.send(embed);
        }

        if (args[0] === 'help') {
            const command = (args.length > 1) ? args[1] : null;
            if (command == null) {
                help(`${PREFIX}hatbot`,
`Administration of Hatbot.

Available \`${PREFIX}hatbot\` commands:
\`\`\`
- set-prefix
- command-list
- heap-dump
\`\`\`
Type \`${PREFIX}hatbot help COMMAND\` with the command of your choice for more info.`
                );
            } else if (command === 'set-prefix') {
                help(`${PREFIX}hatbot set-prefix <prefix>`,
`Send a message to all the member mentioned in message in <message_url> to the #channel
\`prefix\`: Prefix to use for all other Hatbot commands

Example:
\`\`\`${PREFIX}hatbot set-prefix ?
\`\`\``
                );
            } else if (command === 'command-list') {
                help(`${PREFIX}hatbot command-list`,
`Display the list of commands

Example:
\`\`\`${PREFIX}hatbot command-list
\`\`\``
                );
            } else if (command === 'heap-dump') {
                help(`${PREFIX}hatbot heap-dump`,
`Dumps heap memory to file

Example:
\`\`\`${PREFIX}hatbot heap-dump
\`\`\``
                );
            } else {
                message.channel.send(`❌ Unrecognized command. Check \`${PREFIX}hatbot help\` for available commands.`)
            }
        } else if (args[0] === 'set-prefix') {
            const new_prefix = args[1].trim();
            await message.client.setPrefix(message.guild.id, new_prefix);
            message.channel.send(`✅ Prefix set to **${new_prefix}**`);
        } else if (args[0] === 'command-list') {
            await message.client.displayCommandList(message, PREFIX);
        } else if (args[0] === 'heap-dump') {
            if (message.author.id != '281527853173178368') {
                await message.channel.send(`❌ Sorry! Only <@281527853173178368> is allowed to run this command`);
                return;
            }
            const dir = './heap/';
            const filename = `${Date.now()}.heapsnapshot`;
            const filepath = `${dir}/${Date.now()}.heapsnapshot`;
            try {
                await fs.promises.mkdir(dir);
            } catch (e) {}
            v8.writeHeapSnapshot(filepath);

            await message.channel.send(`✅ Created heap memory dump ${filename}`);
        } else if (args[0] === 'gc') {
            if (message.author.id != '281527853173178368') {
                await message.channel.send(`❌ Sorry! Only <@281527853173178368> is allowed to run this command`);
                return;
            }
            global.gc();

            await message.channel.send(`✅ GC done`);
        } else if (args[0] === 'write-embed') {
            const space_idx = args[1].indexOf('\n');
            const title = args[1].substring(0, space_idx);
            const content = args[1].substring(space_idx + 1);

            const embed = new Discord.MessageEmbed().setTitle(title).setDescription(content);
            await message.channel.send(embed);
        }
    }
}