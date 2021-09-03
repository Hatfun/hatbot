const Discord = require('discord.js-light');
const moment = require('moment-timezone');
const logger = require('../libs/logger.js')

async function sping(arg, message_guild, message_channel, client) {
    let match = null;
    if ((match = /^https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)\s+<#(\d+)>\s+([^]*)$/.exec(arg)) != null) {
        const input_guild_id = match[1];
        const input_channel_id = match[2];
        const input_message_id = match[3];
        const output_channel_id = match[4];
        const content = match[5].trim();

        if (message_guild != null && message_guild.id != input_guild_id) {
            message_channel.send(`❌ Cannot use a message link from another Discord server!`);
            return;
        }
        let guild = message_guild != null ? message_guild : client.guilds.cache.get(input_guild_id);

        const input_channel = guild.channels.cache.get(input_channel_id);
        const input_message = await input_channel.messages.fetch(input_message_id);
        if (input_message == null) {
            if (message_channel != null) {
                message_channel.send(`❌ Failed to get message from link!`);
            } else {
                logger.error('❌ Failed to get message from link!');
            }
            
            return;
        }
        
        const output_channel = guild.channels.cache.get(output_channel_id);
        const mentioned_users = input_message.mentions.users;
        const users_str = mentioned_users.map(u => `<@${u.id}>`).join(' ');
        output_channel.send(users_str + "\n" + content);
    }
}

async function load_sping(cache) {
    const sping_at_json = await cache.get('sping-at');
    if (sping_at_json === undefined) {
        return [];
    }
    return JSON.parse(sping_at_json);
}

async function save_sping(cache, arg) {
    const sping_at = await load_sping(cache);
    sping_at.push(arg);
    await cache.set('sping-at', JSON.stringify(sping_at));
}

async function remove_sping(cache, arg) {
    let sping_at = await load_sping(cache);
    sping_at = sping_at.filter(elt => elt != arg);
    await cache.set('sping-at', JSON.stringify(sping_at));      
}

module.exports = {
    name: 'sping2',
    description: 'Small ping utility',
    async setup(client) {
        const cache = client.getCache('global');

        const sping_ats = await load_sping(cache);
        logger.info(`sping_ats: ${sping_ats.length > 0 ? sping_ats.join('\n') : '[]'}`)
        sping_ats.forEach(async sping_at => {
            let match = null;
            if ((match = /^(.+)\s+https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)\s+<#(\d+)>\s+([^]*)$/.exec(sping_at)) != null) {
                const timestamp_str = match[1].trim();
                const input_guild_id = match[2];
                const input_channel_id = match[3];
                const input_message_id = match[4];
                const output_channel_id = match[5];
                const content = match[6].trim();
                const timestamp_ms = moment.tz(timestamp_str, "Europe/Berlin").valueOf();
                
                const sping_arg = sping_at.substring(timestamp_str.length).trim();
                const now_ms = moment().valueOf();
                const timeout_ms = timestamp_ms - now_ms;
                if (timeout_ms < 0) {
                    await remove_sping(cache, sping_at);
                    logger.info(`✅ Removed old sping-at ${sping_at}`);
                } else {
                    setTimeout(async function() {
                        const delayed_cache = client.getCache('global');
                        await sping(sping_arg, null, null, client);
                        await remove_sping(delayed_cache, sping_at);
                    }, timeout_ms);
                    logger.info(`✅ Ping message scheduled to be sent at ${timestamp_str} Server Time!`);
                }                
            }
        });
    },
    async execute(message, args) {
        const RUN = 'sping2'

        const cache = message.client.getCache('global');
        const PREFIX = await message.client.getPrefix(message.guild.id);

        async function help(title, content) {
            await message.client.help(message, title, content);
        }

        if (args == null || args[0] === 'help') {
            const command = (args != null && args.length > 1) ? args[1] : null;
            if (command == null) {
                help(`${PREFIX}sping2`,
`Small utilities to manage sping2s.

Available \`${PREFIX}sping2\` commands:
\`\`\`
- sping
- sping-at
\`\`\`
Type \`${PREFIX}sping2 help COMMAND\` with the command of your choice for more info.`
                );
            } else if (command === 'sping') {
                help(`${PREFIX}sping2 sping <message_url> <#channel> <YOUR MESSAGE>`,
`Sends a message to all the member mentioned in message in <message_url> to the #channel
\`message_url\`: Discord URL pointing to the message containing all the members to ping.
\`#channel\`: Destination channel to send ping
\`YOUR MESSAGE\`: Anything you want to say 😃

Example:
\`\`\`${PREFIX}sping2 sping https://discord.com/channels/745320074608508968/752260375306698752/865072560235479070 #runs Hello! Please be ready on time, thank you <3
\`\`\``
                );
            } else if (command === 'sping-at') {
                help(`${PREFIX}sping2 sping-at <timestamp> <message_url> <#channel> <YOUR MESSAGE>`,
`Sends a message at a specific server time to all the member mentioned in message in <message_url> to the #channel
\`timestamp\`: Date and time. It must be server time (Europe/Berlin)
\`message_url\`: Discord URL pointing to the message containing all the members to ping.
\`#channel\`: Destination channel to send ping
\`YOUR MESSAGE\`: Anything you want to say 😃

Example:
\`\`\`${PREFIX}sping2 sping-at 2021-07-18 15:00 https://discord.com/channels/745320074608508968/752260375306698752/864714550850617405 #general
Hello guys!
Just a reminder that we have DT in exactly 1 hour from now!!
\`\`\``
                );
            } else {
                message.channel.send(`❌ Unrecognized command. Check \`${PREFIX}sping2 help\` for available commands.`);
            }
        } else if (args[0] === 'sping') {
            await sping(args[1], message.guild, message.channel, null);
        } else if (args[0] === 'sping-at') {
            let match = null;
            if ((match = /^(.+)\s+https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)\s+<#(\d+)>\s+([^]*)$/.exec(args[1])) != null) {
                const timestamp_str = match[1].trim();
                const input_guild_id = match[2];
                const input_channel_id = match[3];
                const input_message_id = match[4];
                const output_channel_id = match[5];
                const content = match[6].trim();
                const timestamp_ms = moment.tz(timestamp_str, "Europe/Berlin").valueOf();
                
                const sping_arg = args[1].substring(timestamp_str.length).trim();
                const now_ms = moment().valueOf();
                const timeout_ms = timestamp_ms - now_ms;
                await save_sping(cache, args[1]);
                setTimeout(async function() {
                    await sping(sping_arg, message.guild, message.channel, null);
                    await remove_sping(cache, args[1]);
                }, timeout_ms);
                message.channel.send(`✅ Ping message scheduled to be sent at ${timestamp_str} Server Time!`);
            }
        }
    }
}