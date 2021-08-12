const fs = require('fs');
const Discord = require('discord.js-light');
const config = require('./config.json');
const Keyv = require('keyv');
const logger = require('./libs/logger.js')

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));


const CACHE_TIMEOUT = 1000 * 60 * 10;
const MAX_RANDOM = 15;
class MyDiscordCache {
    constructor(client) {
        this.client = client;
        this.guild_cache = new Map(); // guild_id => guild_info{guild, timestamp}
        this.channel_cache = new Map(); // channel_id => channel_info{channel, timestamp}
        this.message_cache = new Map(); // message_id => message_info{message, timestamp}

        const self = this;
        setInterval(() => self.clearCache(), 600000);
    }

    static expired(expiration) {
        return Date.now() > expiration;
    }

    static newExpiration() {
        return Date.now() + CACHE_TIMEOUT + Math.floor(Math.random() * MAX_RANDOM) * 1000 * 60;
    }

    clearCache() {
        const guild_ids_to_delete = [];
        for (const [guild_id, guild_info] of this.guild_cache) {
            if (MyDiscordCache.expired(guild_info.expiration)) {
                guild_ids_to_delete.push(guild_id);
            }
        }
        for (const guild_id of guild_ids_to_delete) {
            logger.debug(`Removing guild ${guild_id} from cache`);
            this.guild_cache.delete(guild_id);
        }

        const channel_ids_to_delete = [];
        for (const [channel_id, channel_info] of this.channel_cache) {
            if (MyDiscordCache.expired(channel_info.expiration)) {
                channel_ids_to_delete.push(channel_id);
            }
        }
        for (const channel_id of channel_ids_to_delete) {
            logger.debug(`Removing channel ${channel_id} from cache`);
            this.channel_cache.delete(channel_id);
        }

        const message_ids_to_delete = [];
        for (const [message_id, message_info] of this.message_cache) {
            if (MyDiscordCache.expired(message_info.expiration)) {
                message_ids_to_delete.push(message_id);
            }
        }
        for (const message_id of message_ids_to_delete) {
            logger.debug(`Removing message ${message_id} from cache`);
            this.message_cache.delete(message_id);
        }
    }

    async getGuild(guild_id) {
        if ((!this.guild_cache.has(guild_id)) || (MyDiscordCache.expired(this.guild_cache.get(guild_id).expiration))) {
            const expiration = MyDiscordCache.newExpiration();
            logger.info(`Fetch guild ${guild_id} (expiration: ${expiration})`);
            const guild = await this.client.guilds.fetch(guild_id);
            this.guild_cache.set(guild_id, { expiration: expiration, guild: guild });
        } else {
            // logger.info(`Return cached guild ${guild_id}`);
        }
        return this.guild_cache.get(guild_id).guild;
    }

    async getChannel(channel_id) {
        if ((!this.channel_cache.has(channel_id)) || (MyDiscordCache.expired(this.channel_cache.get(channel_id).expiration))) {
            const expiration = MyDiscordCache.newExpiration();
            logger.info(`Fetch channel ${channel_id} (expiration: ${expiration})`);
            const channel = await this.client.channels.fetch(channel_id);
            this.channel_cache.set(channel_id, { expiration: expiration, channel: channel });
        } else {
            // logger.info(`Return cached channel ${channel_id}`);
        }
        return this.channel_cache.get(channel_id).channel;
    }

    async getMessage(channel_id, message_id) {
        if ((!this.message_cache.has(message_id)) || (MyDiscordCache.expired(this.message_cache.get(message_id).expiration))) {
            const expiration = MyDiscordCache.newExpiration();
            logger.info(`Fetch message ${channel_id}/${message_id} (expiration: ${expiration})`);
            const channel = await this.getChannel(channel_id);
            const message = await channel.messages.fetch(message_id);
            this.message_cache.set(message_id, { expiration: expiration, message: message });
        } else {
            // logger.info(`Return cached message ${channel_id}/${message_id}`);
        }
        return this.message_cache.get(message_id).message;
    }
}

const client = new Discord.Client({
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
    messageCacheMaxSize: 0,
    messageEditHistoryMaxSize: 0,

    cacheGuilds: true,
    cacheChannels: false,
    cacheOverwrites: false,
    cacheRoles: false,
    cacheEmojis: false,
    cachePresences: false
});

// TODO: Check if this causes problem to get a new Keyv on each message.
client.getCache = function (namespace) {
    // logger.info(namespace);
    // const keyv = new Keyv('sqlite://' + config.sqlite_db, { namespace: namespace });
    // keyv.on('error', err => logger.error('Connection Error', err));
    // logger.info(keyv);
    // return keyv;
    if (client.cacheMap == null) {
        client.cacheMap = new Discord.Collection();
    }
    if (!client.cacheMap.has(namespace)) {
        const keyv = new Keyv('sqlite://' + config.sqlite_db, { namespace: namespace });
        keyv.on('error', err => logger.error('Connection Error', err));
        client.cacheMap.set(namespace, keyv);
    }
    return client.cacheMap.get(namespace);
}

client.getCachePrefix = async function(guild_id) {
    const cache = this.getCache(guild_id);
    const cache_prefix = await cache.get('prefix');
    return cache_prefix != null ? cache_prefix : config.default_prefix;
}

client.getPrefix = async function(guild_id) {
    if (client.prefix_map == null) {
        client.prefix_map = new Discord.Collection();
    }
    if (!client.prefix_map.has(guild_id)) {
        const cache_prefix = await client.getCachePrefix(guild_id);
        client.prefix_map.set(guild_id, cache_prefix);
    }
    return client.prefix_map.get(guild_id);
}

client.setPrefix = async function(guild_id, prefix) {
    const cache = this.getCache(guild_id);
    await cache.set('prefix', prefix);
    client.prefix_map.set(guild_id, prefix);
}

client.help = async function(message, title, content) {
    const embed = new Discord.MessageEmbed()
        .setColor('#fff999')
        .setTitle(`💡 ${title}`)
        .setDescription(content);
    await message.channel.send(embed);
}

client.displayCommandList = async function(message, prefix) {
    const commands = Array.from(client.commands.keys()).sort();
    const description = commands.map(c => `**${prefix}${c}**\n${client.commands.get(c).description}`).join('\n\n');
    await client.help(message, 'Hatbot command list',
`
${description}

**For more information of a specific command, type the command followed by _help_**
Example: \`${prefix}vend help\`
`
        );
}

client.commands = new Discord.Collection();
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    logger.info(`Loaded module ${command.name}: ${file}`)
    // set a new item in the Collection
    // with the key as the command name and the value as the exported module
    // if (command.setup != null) {
    //     command.setup(client);
    // }
    client.commands.set(command.name, command);
}

client.once('ready', async () => {
    logger.info('Ready!');

    client.discord_cache = new MyDiscordCache(client);
    for (const [command_name, command] of client.commands) {
        if (command.setup != null) {
            try {
                await command.setup(client);
            } catch (exception) {
                logger.error(exception);
            }
        }
    }
});

client.on('message', async message => {
    if (message.author.bot) return;
    if (message.channel.type === 'dm') return;
    const trimmed = message.content.trim();
    const prefix = await client.getPrefix(message.guild.id);
    if (!trimmed.startsWith(prefix)) return;
    const match = /[ \n]/.exec(trimmed);
    if (match === null) return;
    const firstSplit = [trimmed.slice(0, match.index), trimmed.slice(match.index + 1)];
    if (firstSplit.length < 2) return;
    const command = firstSplit[0];
    const match2 = /[ \n]/.exec(firstSplit[1]);
    const args = match2 === null ? [firstSplit[1].trim()] : [firstSplit[1].slice(0, match2.index).trim(), firstSplit[1].slice(match2.index + 1).trim()];
    const noprefix_command = command.slice(1);
    if (!client.commands.has(noprefix_command)) return;
    logger.info(`${command} ${JSON.stringify(args)}`);
    try {
        await client.commands.get(noprefix_command).execute(message, args);
    } catch (error) {
        logger.error(JSON.stringify(error));
        message.channel.send('❌ Some unexpected error occurred.\n<@281527853173178368>!!!! You\'re a noob!! Fix it now!');
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    for (const [command_name, command] of client.commands) {
        if (command.onReaction != null) {
            try {
                await command.onReaction(reaction, user);
            } catch (exception) {
                logger.error(exception);
            }
        }
    }
});

client.on('error', err => {
    logger.error(err);
});

client.on('warn', info => {
    logger.warn(info);
});

client.on('rateLimit', rateLimitData => {
    logger.warn(JSON.stringify(rateLimitData));
});

if (config.debug) {
    client.on('debug', info => {
        logger.debug(info);
    });
}

client.login(config.token);