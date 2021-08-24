"use strict";

const Discord = require('discord.js-light');
const emojiRegex = require('emoji-regex/RGI_Emoji.js');
const moment = require('moment-timezone');
const logger = require('../libs/logger.js')

const GLOBAL_MESSAGE_MAP = 'run_global_message_map';
const CHANNEL_TEMPLATE = 'run_template_channel';
const CHANNEL_RUN_ARCHIVES = 'run_archives_channel';
const CHANNEL_RUN_BOARD = 'run_board_channel';
const ROLE_MENTIONS = 'run_role_mentions';
const BOARDS = 'run_boards';

const global_embeds = new Discord.Collection();
const user_busy = new Set();

const TIMEOUT_MS = 120000;

const FIELD_WHEN = 0;
const FIELD_CHANNEL = 1;
const FIELD_NOTE = 2;
const SERVER_TIME_PREFIX = '';

const TIMEZONES = [
    { region: 'America', timezones: [
        { name: 'Los Angeles',  flag: ':flag_us:',  tz: 'America/Los_Angeles' },
        { name: 'Denver',       flag: ':flag_us:',  tz: 'America/Denver' },
        { name: 'Chicago',      flag: ':flag_us:',  tz: 'America/Chicago' },
        { name: 'New York',     flag: ':flag_us:',  tz: 'America/New_York' },
        { name: 'São Paulo',    flag: ':flag_br:',  tz: 'America/Sao_Paulo' }
    ]},
    { region: 'Europe', timezones: [
        { name: 'London',       flag: ':flag_gb:',  tz: 'Europe/London' },
        { name: 'Berlin',       flag: ':flag_de:',  tz: 'Europe/Berlin' },
        { name: 'Moscow',       flag: ':flag_ru:',  tz: 'Europe/Moscow' },
    ]},
    { region: 'Asia', timezones: [
        { name: 'Dubai',        flag: ':flag_ae:',  tz: 'Asia/Dubai' },
        { name: 'Kolkata',      flag: ':flag_in:',  tz: 'Asia/Kolkata' },
        { name: 'Omsk',         flag: ':flag_ru:',  tz: 'Asia/Omsk' },
        { name: 'Jakarta',      flag: ':flag_id:',  tz: 'Asia/Jakarta' },
        { name: 'Kuala Lumpur', flag: ':flag_my:',  tz: 'Asia/Kuala_Lumpur' },
        { name: 'Manila',       flag: ':flag_ph:',  tz: 'Asia/Manila' },
        { name: 'Singapore',    flag: ':flag_sg:',  tz: 'Asia/Singapore' }
    ]},
    { region: 'Australia', timezones: [
        { name: 'Adelaide',     flag: ':flag_au:',  tz: 'Australia/Adelaide' },
        { name: 'Sydney',       flag: ':flag_au:',  tz: 'Australia/Sydney' }
    ]}
];

function set_user_busy(user_id, guild_id, channel_id) {
    user_busy.add(`${user_id}|${guild_id}|${channel_id}`);
}

function is_user_busy(user_id, guild_id, channel_id) {
    return user_busy.has(`${user_id}|${guild_id}|${channel_id}`);
}

function set_user_free(user_id, guild_id, channel_id) {
    user_busy.delete(`${user_id}|${guild_id}|${channel_id}`);
}

function flexible_parse_date(date_str) {
    // Old style
    let date_time = moment.tz(date_str, 'MMMM Do YYYY h:mm A', 'Europe/Berlin');
    if (!date_time.isValid()) {
        // New style. moment() always assumes it's for current year.
        date_time = moment.tz(date_str, 'dddd MMMM Do [@] h:mm A', 'Europe/Berlin');
        // Try to parse next year, assuming that day of the week is NEVER the same on year n + 1
        if (!date_time.isValid()) {
            date_time = moment.tz((moment().year() + 1) + " " + date_str, 'YYYY dddd MMMM Do [@] h:mm A', 'Europe/Berlin');
            if (!date_time.isValid())
                return null;
        }
    }
    return date_time;
}

function get_embed(message_id) {
    return global_embeds.get(message_id);
}

function embed_get_channel_from_id(embed) {
    return embed.fields[FIELD_CHANNEL].value.slice(2, -1);
}

function embed_update_roster(embed, roster) {
    embed.setDescription(roster);
}

function embed_update_time_from_now(embed) {
    const full_when = embed.fields[FIELD_WHEN].name;
    const when = full_when.substring(SERVER_TIME_PREFIX.length);
    const date_time = flexible_parse_date(when);

    embed.fields[FIELD_WHEN].value = readable_date_from_now(date_time);
}

function embed_update_date_time(embed, date_time) {
    // Old style
    // const when = `${SERVER_TIME_PREFIX}${date_time.format('MMMM Do YYYY h:mm A')}`;
    // New style
    const when = `${SERVER_TIME_PREFIX}${date_time.format('dddd MMMM Do [@] h:mm A')}`;
    embed.fields[FIELD_WHEN].name = when;

    embed_update_time_from_now(embed);
}

function embed_is_update_time_from_now_needed(embed) {
    const full_when = embed.fields[FIELD_WHEN].name;
    const when = full_when.substring(SERVER_TIME_PREFIX.length);
    const date_time = flexible_parse_date(when);

    const duration = moment.duration(date_time.diff(moment().subtract(1, 'minutes')));

    const current_update = embed.fields[FIELD_WHEN].value;
    let match = null;
    let current_update_to_minutes = 0;
    if (match = /(^|\s+)(\d+) day/.exec(current_update)) {
        current_update_to_minutes += parseInt(match[2]) * 24 * 60;
    }
    if (match = /(^|\s+)(\d+) hour/.exec(current_update)) {
        current_update_to_minutes += parseInt(match[2]) * 60;
    }
    if (match = /(^|\s+)(\d+) minute/.exec(current_update)) {
        current_update_to_minutes += parseInt(match[2]);
    }
    if (match = / ago/.exec(current_update)) {
        current_update_to_minutes = -current_update_to_minutes;
    }
    const actual_update_to_minutes = duration.asMinutes();
    const diff = current_update_to_minutes - actual_update_to_minutes;

    if (actual_update_to_minutes < -120 && diff > 60) {
        // If already passed, update once per hour
        return true;
    }  else if (actual_update_to_minutes >= -120 && actual_update_to_minutes < 0) {
        // Update all the time during the hour when event occurs
        return true;
    } else if (actual_update_to_minutes >= 60 * 24 * 3 && diff > 15) {
        // Update every 15 minutes if > 3 day
        return true;
    } else if (actual_update_to_minutes >= 60 * 24 && diff > 10) {
        // Update every 10 minutes if > 1 day
        return true;
    } else if (actual_update_to_minutes >= 60 * 12 && diff > 5) {
        // Update every 5 minutes if > 12 hours
        return true;
    } else if (actual_update_to_minutes >= 0 && actual_update_to_minutes < 60 * 12) {
        // Update all the time if < 12 hours
        return true;
    }
    // Otherwise don't update
    return false;
}

function embed_find_field_index_by_name(embed, name) {
    return embed.fields.findIndex(f => f.name === name);
}

function embed_update_note(embed, note) {
    let note_idx = embed_find_field_index_by_name(embed, 'Note');
    if (note_idx == -1) {
        embed.addField('\u200B', '\u200B');
        for (let i = embed.fields.length - 1; i >= FIELD_NOTE; i--) {
            embed.fields[i].name = embed.fields[i - 1].name;
            embed.fields[i].value = embed.fields[i - 1].value;
        }

        note_idx = FIELD_NOTE;
        embed.fields[note_idx].name = 'Note';
    }
    embed.fields[note_idx].value = note;
}

function embed_add_reminder(embed, reminder_minutes) {
    const readable = reminder_to_readable(reminder_minutes);
    const full_when = embed.fields[FIELD_WHEN].name;
    const when = full_when.substring(SERVER_TIME_PREFIX.length);
    const date_time = flexible_parse_date(when);

    let reminder_idx = embed_find_field_index_by_name(embed, 'Reminders');
    if (reminder_idx == -1) {
        embed.addField('\u200B', '\u200B');
        const last_idx = embed.fields.length - 1;
        embed.fields[last_idx].name = embed.fields[last_idx - 1].name;
        embed.fields[last_idx].value = embed.fields[last_idx - 1].value;

        reminder_idx = last_idx - 1;
        embed.fields[reminder_idx].name = 'Reminders';
        embed.fields[reminder_idx].value = `• ${readable}`;
    } else {
        embed.fields[reminder_idx].value += `\n• ${readable}`;
    }
    const lines = [... new Set(embed.fields[reminder_idx].value.split('\n'))];
    lines.sort((r1_str, r2_str) => {
        const r1 = parse_reminder(r1_str.substring(2));
        const r2 = parse_reminder(r2_str.substring(2));
        return r2 - r1;
    });
    embed.fields[reminder_idx].value = lines.join('\n');
}

function embed_clear_reminder(embed) {
    let reminder_idx = embed_find_field_index_by_name(embed, 'Reminders');
    if (reminder_idx == -1) {
        return;
    }
    const last_idx = embed.fields.length - 1;

    embed.fields[last_idx - 1].name = embed.fields[last_idx].name;
    embed.fields[last_idx - 1].value = embed.fields[last_idx].value;

    embed.fields.splice(last_idx - 1, 1);
}

function embed_get_distinct_available_emojis(embed) {
    const emojis = new Set();
    const lines = embed.description.split('\n');
    let current_players = 0;
    let max_players = 0;
    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }

        if (emoji != null && (match = /<@[!]?(\d+)>/.exec(line)) == null) {
            emojis.add(emoji);
        }
    }

    return emojis;
}

function embed_update_number_of_players(embed) {
    const lines = embed.description.split('\n');
    let current_players = 0;
    let max_players = 0;
    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }

        if (emoji != null) {
            max_players += 1;
            if ((match = /<@[!]?(\d+)>/.exec(line)) != null) {
                current_players += 1;
            }
        }
    }

    embed.setFooter(`${current_players} out of ${max_players} spots taken`);
}

function embed_get_distinct_roles(embed) {
    const lines = embed.description.split('\n');
    let players = 0;
    const roles = new Set();
    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }
        if (emoji != null) {
            roles.add(emoji);
        }
    }

    return roles;
}

function embed_update_user_to_roster(embed, user_id, role) {
    const lines = embed.description.split('\n');

    let changed = null;

    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }


        if (emoji != null && emoji == role && (match = /<@[!]?\d+>/.exec(line)) == null) {
            changed = clean_role(line);
            lines[i] = line + ` <@${user_id}>`;
            break;
        }
        if (emoji != null && role == '❌' && (match = /<@[!]?(\d+)>/.exec(line)) != null) {
            const match_user_id = match[1];
            if (match_user_id === user_id) {
                lines[i] = line.slice(0, match.index);
                changed = true;
            }
        }
    }
    embed.description = lines.join('\n');

    return changed;
}

function embed_get_players(embed) {
    const lines = embed.description.split('\n');
    const players = new Set();
    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }

        if (emoji != null && (match = /<@[!]?(\d+)>/.exec(line)) != null) {
            players.add(`<@${match[1]}>`);
        }
    }

    return Array.from(players);
}

function embed_get_roles_for_user(embed, user_id) {
    const roles = [];
    const lines = embed.description.split('\n');

    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }

        if (emoji != null && (match = /<@[!]?(\d+)>/.exec(line)) != null) {
            const match_user_id = match[1];
            if (match_user_id === user_id) {
                const role = line.slice(0, match.index);
                roles.push({role: role, emoji: emoji});
            }
        }
    }

    return roles;
}

function embed_update_char_name_for_user_and_role(embed, user_id, char_names) {
    const added_char_names = [];
    const lines = embed.description.split('\n');
    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }
        if (emoji != null && (match = /<@[!]?(\d+)>/.exec(line)) != null) {
            const match_user_id = match[1];
            if (match_user_id === user_id) {// && line.startsWith(role)) {
                for (const char_name_idx in char_names) {
                    const char_name = char_names[char_name_idx];
                    if (line.startsWith(char_name.role)) {
                        lines[i] = line.slice(0, match.index) + ` <@${user_id}> [${Discord.escapeMarkdown(char_name.char_name)}]`;
                        added_char_names.push(`        ${clean_role(char_name.role)} set to **${Discord.escapeMarkdown(char_name.char_name)}**`);
                        char_names.splice(char_name_idx, 1);
                        break;
                    }
                }
            }
        }
    }
    embed.description = lines.join('\n');

    return added_char_names;
}

function embed_change_role_for_user_and_role(embed, user_id, old_role, new_role) {
    let updated = false;
    const lines = embed.description.split('\n');
    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }
        if (emoji != null && (match = /<@[!]?(\d+)>/.exec(line)) != null) {
            const match_user_id = match[1];
            if (match_user_id === user_id) {// && line.startsWith(role)) {
                const role = line.slice(0, match.index);
                const rest_of_line = line.slice(match.index);

                if (role == old_role) {
                    const new_line = `${new_role} ${rest_of_line}`;
                    lines[i] = new_line;
                    updated = true;
                    break;
                }
            }
        }
    }
    embed.description = lines.join('\n');

    return updated;
}

function embed_swap_roles(embed, user_id_1, role_1, user_id_2, role_2) {
    const lines = embed.description.split('\n');
    let line_1 = null;
    let line_2 = null;
    for (let i = 0; i < lines.length; ++i) {
        const unicodeRegex = emojiRegex();
        const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

        const line = lines[i];
        let match;
        let emoji = null;
        if ((match = unicodeRegex.exec(line)) && match.index === 0) {
            emoji = match[0];
        } else if ((match = hasEmoteRegex.exec(line)) && match.index === 0) {
            emoji = match[1];
        }
        if (emoji != null && (match = /<@[!]?(\d+)>/.exec(line)) != null) {
            const match_user_id = match[1];
            if (match_user_id === user_id_1) {
                const role = line.slice(0, match.index);
                const rest_of_line = line.slice(match.index);

                if (role == role_1 && line_1 == null) {
                    line_1 = { idx: i, role: role, rest_of_line: rest_of_line };
                }
            }
            if (match_user_id === user_id_2) {
                const role = line.slice(0, match.index);
                const rest_of_line = line.slice(match.index);

                if (role == role_2 && line_2 == null) {
                    line_2 = { idx: i, role: role, rest_of_line: rest_of_line };
                }
            }
        }
    }
    lines[line_1.idx] = `${line_1.role}${line_2.rest_of_line}`;
    lines[line_2.idx] = `${line_2.role}${line_1.rest_of_line}`;

    embed.description = lines.join('\n');
}

async function get_embed_channel_from(client, embed) {
    const channel_id = embed_get_channel_from_id(embed);
    const channel_from = await client.discord_cache.getChannel(channel_id);

    return channel_from;
}

function get_embeds_linked_to_channel(command_channel_id) {
    return [...global_embeds]
        .filter(([msg_id, embed]) => embed_get_channel_from_id(embed) === command_channel_id)
        .map(([msg_id, embed]) => { return { message_id: msg_id, embed: embed }; });
        // In case we want to sort by name... but natural order of insertion seems more natural
        // .sort((mie1, mie2) => mie1.embed.title.localeCompare(mie2.embed.title));
}

function reminder_to_readable(minutes) {
    const days = Math.floor(minutes / 1440);
    minutes -= days * 1440;
    const hours = Math.floor(minutes / 60);
    minutes -= hours * 60;
    const readable = [];
    if (days > 0) {
        readable.push(`${days} day${days > 1 ? 's' : ''}`);
    }
    if (hours > 0) {
        readable.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
        readable.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    }
    return `${readable.join(' ')} before`;
}

function parse_reminder(reminder_str) {
    const match = /^((\d+)\s+days?\s+)?((\d+)\s+hours?\s+)?((\d+)\s+minutes?\s+)?before$/.exec(reminder_str);

    if (match == null) {
        return null;
    }
    let minutes = 0;
    // days to minutes
    if (match[2]) {
        minutes += parseInt(match[2]) * 1440;
    }
    // hours to minutes
    if (match[4]) {
        minutes += parseInt(match[4]) * 60;
    }
    // minutes
    if (match[6]) {
        minutes += parseInt(match[6]);
    }
    return minutes;
}

async function update_user_to_roster(client, msg, user_id, emoji_name) {
    const embed = get_embed(msg.id);

    const added = embed_update_user_to_roster(embed, user_id, emoji_name);

    const channel_from = await get_embed_channel_from(client, embed);
    if (added) {
        embed_update_number_of_players(embed);
        embed_update_time_from_now(embed);
        msg.edit(embed);
        await channel_from.send(`✅ **${embed.title}**: Added <@${user_id}> as ${added}!`);
    } else {
        await channel_from.send(`❌ **${embed.title}**: Couldn't add <@${user_id}> to roster!`);
    }
}

async function remove_user_from_roster(client, msg, user_id, emoji_name) {
    const embed = get_embed(msg.id);

    const removed = embed_update_user_to_roster(embed, user_id, emoji_name);
    const channel_from = await get_embed_channel_from(client, embed);
    if (removed) {
        embed_update_number_of_players(embed);
        embed_update_time_from_now(embed);
        msg.edit(embed);
        await channel_from.send(`❌ **${embed.title}**: Removed <@${user_id}>!`);
    }
}

function readable_date_from_now(date_time) {
    const duration = moment.duration(date_time.diff(moment().subtract(1, 'minutes')));

    let now_diff_str;
    if (parseInt(duration.asMinutes()) == 0) {
        now_diff_str = 'Now';
    } else {
        const days = Math.abs(parseInt(duration.asDays()));
        const hours = Math.abs(parseInt(duration.asHours())) % 24;
        const minutes = Math.abs(parseInt(duration.asMinutes())) % 60;
        let now_diff_arr = [];
        if (days > 0) {
            now_diff_arr.push(`${days} day${days > 1 ? 's' : ''}`);
        }
        if (hours > 0) {
            now_diff_arr.push(`${hours} hour${hours > 1 ? 's' : ''}`);
        }
        if (minutes > 0) {
            now_diff_arr.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
        }
        if (duration.asMinutes() > 0) {
            now_diff_str = `In ${now_diff_arr.join(' ')}`;
        } else {
            now_diff_str = `${now_diff_arr.join(' ')} ago`;
        }
    }
    return now_diff_str;
}

function clean_role(role) {
    let cleaned = role.trim();
    let changed = false;
    while (cleaned.endsWith('-') || cleaned.endsWith(':') || cleaned.endsWith('=') || cleaned.endsWith(' ')) {
        cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
}

async function update_char_name_to_roster_by_message_id(client, message_id, player_id, channel, user, messages_to_delete) {
    const embed = get_embed(message_id);
    const channel_id = embed_get_channel_from_id(embed);
    const message = await client.discord_cache.getMessage(channel_id, message_id);
    await update_char_name_to_roster(client, message, player_id, channel, user, messages_to_delete);
}

async function update_char_name_to_roster(client, msg, player_id, channel, user, messages_to_delete) {
    const embed = get_embed(msg.id);
    const roles = embed_get_roles_for_user(embed, player_id);

    const filter = m => m.author.id == user.id;
    const char_names = [];
    let timed_out = false;
    for (const role of roles) {
        const question = `**${embed.title}**
Please enter char name for **${clean_role(role.role)}**:`;
        const question_embed = new Discord.MessageEmbed().setTitle('📝 Char name').setDescription(question);

        const question_message = await channel.send(question_embed);
        if (messages_to_delete != null) {
            messages_to_delete.push(question_message);
        }
        await channel.awaitMessages(filter, { max: 1, time: TIMEOUT_MS, errors: ['time'] })
        .then(async reply => {
            if (messages_to_delete != null) {
                messages_to_delete.push(reply.first());
            }
            const char_name = reply.first().content;
            char_names.push({ role: role.role, char_name: char_name });
        })
        .catch(async exception => {
            if (exception instanceof Error) {
                throw exception;
            } else {
                await channel.send(`❌ ${user.id == null ? '' : '<@' + user.id +'> '}Command timed out! 🐢`);
                timed_out = true;
            }
        });
        if (timed_out)
            return;
    }

    const added_char_names = embed_update_char_name_for_user_and_role(embed, player_id, char_names);

    if (added_char_names.length > 0) {
        const s = added_char_names.length > 1 ? 's' : '';
        embed_update_time_from_now(embed);
        await msg.edit(embed);
        const channel_from = await get_embed_channel_from(client, embed);
        if (channel.id != channel_from.id) {
            await channel.send(`✅ **${embed.title}**: Char name${s} updated!`);
        }
        await channel_from.send(`✅ **${embed.title}**: Set char name${s} for <@${player_id}>:
${added_char_names.join('\n')}`);
        if (messages_to_delete != null) {
            await bulkDelete(channel_from, messages_to_delete);
        }
    }
}

async function show_when(msg_id, user_id, channel, delete_prompt, messages_to_delete) {
    const embed = get_embed(msg_id);
    const full_when = embed.fields[FIELD_WHEN].name;
    const when = full_when.substring(SERVER_TIME_PREFIX.length);
    const date_time = flexible_parse_date(when);
    const from_now = readable_date_from_now(date_time);

    const tz_array = [];
    let i = 0;
    const lines = [];
    for (const region_tz of TIMEZONES) {
        lines.push(`\n**${region_tz.region}**`)
        for (const tz of region_tz.timezones) {
            i++;
            lines.push(`\`${(i + '.').padEnd(3)}\`  ${tz.flag} ${tz.name}`);
            tz_array.push(tz);
        }
    }

    const question = `**${embed.title}** happens on **${when} Server Time!**

Please choose your timezone by entering a number between 1 and ${tz_array.length}:
${lines.join('\n')}
`;
    const question_embed = new Discord.MessageEmbed().setTitle('🕒 Select timezone').setDescription(question);

    const filter = filter_number(channel, user_id, 1, tz_array.length, messages_to_delete);
    const question_msg = await channel.send(question_embed);
    if (messages_to_delete != null) {
        messages_to_delete.push(question_msg);
    }
    await channel.awaitMessages(filter, { max: 1, time: TIMEOUT_MS, errors: ['time'] })
    .then(async reply => {
        const choice = parseInt(reply.first().content);

        const timezone = tz_array[choice - 1];
        const converted_date_time = date_time.clone().tz(timezone.tz).format('dddd MMMM Do [@] h:mm A');
        const time_embed = new Discord.MessageEmbed()
            .setTitle(`🕒  ${embed.title}`)
            .setDescription(`${timezone.flag}  This run will happen on\n**${converted_date_time} ${timezone.name} time**!\n${from_now}`);
        await channel.send(time_embed);
        if (delete_prompt) {
            await bulkDelete(channel, messages_to_delete);
        }
    }).catch(timeout_function(channel, user_id));
}

async function process_reaction(reaction, user) {
    if (reaction.emoji.name === '🕒') {
        const dm_channel = await user.createDM(true);
        await show_when(reaction.message.id, user.id, dm_channel, false);
    } else if (reaction.emoji.name === '📝') {
        const dm_channel = await user.createDM(true);
        await update_char_name_to_roster(reaction.message.client, reaction.message, user.id, dm_channel, user);
    } else if (reaction.emoji.name === '❌') {
        await remove_user_from_roster(reaction.message.client, reaction.message, user.id, reaction.emoji.name);
    } else {
        await update_user_to_roster(reaction.message.client, reaction.message, user.id, reaction.emoji.toString());
    }

    await reaction.users.remove(user.id);
}

async function process_reactions(client, run_message) {
    const message_reactions = run_message.reactions.cache;
    for (const [emoji_name, message_reaction] of message_reactions) {
        const users = await message_reaction.users.fetch();
        // const users = message_reaction.users.cache;
        for (const [user_id, user] of users) {
            if (user_id != client.user.id) {
                logger.info(`process_reactions: ${user_id} reacted ${message_reaction.emoji.toString()} on msg ${message_reaction.message.id}`);
                await process_reaction(message_reaction, user);
            }
        }
    }
}

async function delete_run_from_cache(client, message_id) {
    const global_cache = client.getCache('global');
    const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
    if (message_map == null) {
        return;
    }

    const messages_to_cleanup = [];
    for (const guild_id in message_map) {
        for (const channel_id in message_map[guild_id]) {
            if (message_map[guild_id][channel_id].includes(message_id)) {
                logger.info(`delete_run_from_cache: Deleting message ${message_id} from cache`);
                const message_id_idx = message_map[guild_id][channel_id].indexOf(message_id);
                message_map[guild_id][channel_id].splice(message_id_idx, 1);
                global_embeds.delete(message_id);
                await global_cache.set(GLOBAL_MESSAGE_MAP, message_map);
                return true;
            }
        }
    }
    logger.warn(`delete_run_from_cache: Message ${message_id} not found!`);
    return false;
}

async function check_and_update_reminders(client, embed) {
    let edit_message = false;
    let reminder_idx = embed_find_field_index_by_name(embed, 'Reminders');
    if (reminder_idx == -1) {
        return;
    }
    if (embed.fields[reminder_idx].value === '\u200B') {
        return;
    }

    const lines = embed.fields[reminder_idx].value.split('\n');
    const line = lines[0];
    const reminder_minutes = parse_reminder(line.substring(2));
    const full_when = embed.fields[FIELD_WHEN].name;
    const when = full_when.substring(SERVER_TIME_PREFIX.length);
    const date_time = flexible_parse_date(when).subtract(reminder_minutes, 'm');
    if (date_time.isBefore(moment())) {
        embed_update_time_from_now(embed);
        lines.splice(0, 1);
        if (lines.length == 0) {
            embed_clear_reminder(embed);
        } else {
            embed.fields[reminder_idx].value = lines.join('\n');
        }
        edit_message = true;

        const players = embed_get_players(embed);
        if (players.length > 0) {
            const channel_from = await get_embed_channel_from(client, embed);
            const content = `📢 **${embed.title}**
${players.join(' ')}

This is an automated reminder that **${embed.title}** will happen on **${when}** (${embed.fields[FIELD_WHEN].value})`;
            await channel_from.send(content);
        }
    }

    return edit_message;
}

async function update_all_runs(client) {
    const global_cache = client.getCache('global');
    const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
    if (message_map == null) {
        return;
    }

    const messages_to_cleanup = [];
    for (const guild_id in message_map) {
        const guild = await client.discord_cache.getGuild(guild_id);
        for (const channel_id in message_map[guild_id]) {
            const channel = await client.discord_cache.getChannel(channel_id);
            for (let message_id_idx in message_map[guild_id][channel_id]) {
                const message_id = message_map[guild_id][channel_id][message_id_idx];
                try {
                    const run_message = await client.discord_cache.getMessage(channel_id, message_id);
                    const embed = get_embed(run_message.id);

                    let edit_message = false;
                    // Update time from now
                    if (embed_is_update_time_from_now_needed(embed)) {
                        embed_update_time_from_now(embed);
                        edit_message = true;
                    }

                    // Check for reminders
                    if (await check_and_update_reminders(client, embed)) {
                        edit_message = true;
                    }

                    if (edit_message) {
                        await run_message.edit(embed);
                    }
                } catch (exception) {
                    if (exception.code === 10008) {
                        // Remove from cache if not found
                        messages_to_cleanup.push({ guild_id: guild_id, channel_id: channel_id, message_id: message_id });
                        logger.info(`update_all_runs: Message ${guild_id}/${channel_id}/${message_id} not found! Removing from cache!`);
                    } else {
                        logger.error(exception);
                    }
                }
            }
        }
    }

    if (messages_to_cleanup.length > 0) {
        for (const m of messages_to_cleanup) {
            const message_id_idx = message_map[m.guild_id][m.channel_id].indexOf(m.message_id);
            message_map[m.guild_id][m.channel_id].splice(message_id_idx, 1);
            global_embeds.delete(m.message_id);
        }
        await global_cache.set(GLOBAL_MESSAGE_MAP, message_map);
    }
}

async function get_message_by_id_from_global_cache(client, message_id) {
    const global_cache = client.getCache('global');
    const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
    if (message_map == null) {
        return null;
    }
    for (const guild_id in message_map) {
        for (const channel_id in message_map[guild_id]) {
            if (message_map[guild_id][channel_id].includes(message_id)) {
                const channel = await client.discord_cache.getChannel(channel_id);
                const message = await client.discord_cache.getMessage(channel_id, message_id);

                return message;
            }
        }
    }
    return null;
}

async function get_role_mentions(guild_cache) {
    const role_mentions = await guild_cache.get(ROLE_MENTIONS);
    return role_mentions == null ? [] : role_mentions;
}

async function add_role_mentions(guild_cache, role_mention) {
    const role_mentions = await get_role_mentions(guild_cache);
    if (!role_mentions.includes(role_mention)) {
        role_mentions.push(role_mention);
    }
    await guild_cache.set(ROLE_MENTIONS, role_mentions);
}

async function remove_role_mentions(guild_cache, role_mention) {
    const role_mentions = await get_role_mentions(guild_cache);
    const role_mention_idx = role_mentions.indexOf(role_mention);
    if (role_mention_idx >= 0) {
        role_mentions.splice(role_mention_idx, 1);
    }
    await guild_cache.set(ROLE_MENTIONS, role_mentions);
}

async function message_validate_channels(message, guild_cache, PREFIX) {
    let errors = [];
    if (await guild_cache.get(CHANNEL_TEMPLATE) == null) {
        errors.push(`❌ Please set template channel by typing \`${PREFIX}run set-template-channel #channel\``);
    }
    if (await guild_cache.get(CHANNEL_RUN_ARCHIVES) == null) {
        errors.push(`❌ Please set archives channel by typing \`${PREFIX}run set-archives-channel #channel\``);
    }
    if (errors.length > 0) {
        await message.channel.send(errors);
        return false;
    }
    return true;
}

async function message_validate_board_channel(message, guild_cache, PREFIX) {
    let errors = [];
    if (await guild_cache.get(CHANNEL_RUN_BOARD) == null) {
        errors.push(`❌ Please set board channel by typing \`${PREFIX}run set-board-channel #board\``);
    }
    if (errors.length > 0) {
        await message.channel.send(errors);
        return false;
    }
    return true;
}

async function client_get_channel(client, guild_cache, channel_key) {
    return client.discord_cache.getChannel(await guild_cache.get(channel_key));
}

async function message_get_channel_by_id(message, channel_id) {
    return message.client.discord_cache.getChannel(channel_id);
}

async function message_get_template_list(message, guild_cache) {
    const channel = await client_get_channel(message.client, guild_cache, CHANNEL_TEMPLATE);
    const channel_messages = await channel.messages.fetch({ limit: 100 });

    const template_list = channel_messages.map(msg => {
        let [title, ...content] = msg.content.split('\n')
        content = content.join('\n')
        return { id: msg.id, title: title, content: content };
    });

    if (template_list.length == 0) {
        await message.channel.send(`❌ Cannot find any template in ${channel.name}!`);
        return null;
    }
    return template_list.sort((t1, t2) => t1.title.localeCompare(t2.title));
}

async function message_add_message_to_global_cache(message, run_message, embed) {
    const global_cache = message.client.getCache('global');
    let message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
    if (message_map == null) {
        message_map = {};
    }
    if (!(message.guild.id in message_map)) {
        message_map[message.guild.id] = {};
    }
    if (!(run_message.channel.id in message_map[message.guild.id])) {
        message_map[message.guild.id][run_message.channel.id] = [];
    }
    if (!message_map[message.guild.id][run_message.channel.id].includes(run_message.id)) {
        message_map[message.guild.id][run_message.channel.id].push(run_message.id);
    }
    await global_cache.set(GLOBAL_MESSAGE_MAP, message_map);
    // In-memory global embeds
    global_embeds.set(run_message.id, embed);
}

async function message_create_new_run(message, guild_cache, name, date_time, template, channel_from, channel_to, role_ping, messages_to_delete) {
    const embed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(name)
        .setAuthor(message.author.username, message.author.displayAvatarURL({format: 'jpg'}))
        .setDescription((template.content.startsWith('\n') ? '\u200B' : '') + template.content + '\n\u200B')
        .addFields(
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Channel', value: `<#${channel_from.id}>`, inline: true },
            // { name: '\u200B', value: '\u200B' },
            { name: '\u200B', value: `React to signup!
🕒 = When | 📝 = Char name | ❌ = Remove` },
        );
    embed_update_number_of_players(embed);
    embed_update_date_time(embed, date_time);
    const run_message = await channel_to.send(role_ping, [embed]);

    await message_add_message_to_global_cache(message, run_message, embed);
    await client_refresh_board(message.client, guild_cache, message.guild.id, channel_to.id);
    await channel_from.send(`✅ **${name}** Successfully setup new run on <#${channel_to.id}>`);
    await bulkDelete(message.channel, messages_to_delete);
    // Don't await here
    reset_reactions(run_message, embed);
}

async function message_update_roster(message, msg_id_embed, roster, messages_to_delete) {
    if (roster != null) {
        const embed = msg_id_embed.embed;
        const distinct_roles_before = Array.from(embed_get_distinct_roles(embed));
        embed_update_roster(embed, roster);
        const distinct_roles_after = Array.from(embed_get_distinct_roles(embed));
        embed_update_number_of_players(embed);
        const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
        embed_update_time_from_now(embed);
        await run_msg.edit(embed);

        // Confirmation before working with reactions
        await message.channel.send(`✅ **${embed.title}** Roster updated!`);
        await bulkDelete(message.channel, messages_to_delete);
        if (JSON.stringify(distinct_roles_before) != JSON.stringify(distinct_roles_after)) {
            await reset_reactions(run_msg, embed);
        }
    }
}

async function message_update_datetime(message, guild_cache, msg_id_embed, date_time) {
    if (date_time != null) {
        const embed = msg_id_embed.embed;
        embed_update_date_time(embed, date_time);
        const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
        await run_msg.edit(embed);

        const channel_from = await get_embed_channel_from(message.client, embed);
        await client_refresh_board(message.client, guild_cache, message.guild.id, run_msg.channel.id);
        await channel_from.send(`✅ **${embed.title}**: Date and time updated!`);
    }
}

async function message_update_note(message, msg_id_embed, note) {
    if (note == null)
        note = '\u200B';
    const embed = msg_id_embed.embed;
    embed_update_note(embed, note);
    const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
    embed_update_time_from_now(embed);
    await run_msg.edit(embed);

    const channel_from = await get_embed_channel_from(message.client, embed);
    await channel_from.send(`✅ **${embed.title}**: Note updated!`);
}

async function message_add_reminder(message, msg_id_embed, reminder_minutes) {
    const embed = msg_id_embed.embed;
    embed_add_reminder(embed, reminder_minutes);
    const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
    embed_update_time_from_now(embed);
    await run_msg.edit(embed);

    await message.channel.send(`✅ **${embed.title}**: Reminder updated!`);
}

async function message_clear_reminders(message, msg_id_embed) {
    const embed = msg_id_embed.embed;

    embed_clear_reminder(embed);
    const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
    embed_update_time_from_now(embed);
    await run_msg.edit(embed);

    await message.channel.send(`✅ **${embed.title}**: Reminders cleared!`);
}

async function message_ping(message, embed, ping_message) {
    const players = embed_get_players(embed);

    const channel_from = await get_embed_channel_from(message.client, embed);
    if (players.length > 0) {
      const content = `📢 **${embed.title}**
${players.join(' ')}

${ping_message}`;
        await channel_from.send(content);
    } else {
        await channel_from.send(`❌ **${embed.title}**: No one has signed up yet!`);
    }
}

async function message_end_run(message, guild_cache, msg_id_embed) {
    const embed = msg_id_embed.embed;
    const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
    const channel_to_id = run_msg.channel.id;
    await run_msg.delete();

    const channel_archives = await client_get_channel(message.client, guild_cache, CHANNEL_RUN_ARCHIVES);
    const channel_from = await get_embed_channel_from(message.client, embed);
    embed.setColor("#009900");
    embed.fields.splice(embed.fields.length - 1, 1);
    await channel_archives.send(embed);

    await delete_run_from_cache(message.client, msg_id_embed.message_id);
    await client_refresh_board(message.client, guild_cache, message.guild.id, channel_to_id);
    await channel_from.send(`✅ **${embed.title}** is over. Roster message has been archived!`);
}

async function message_add_player(message, msg_id_embed, player_user_id, messages_to_delete) {
    if (player_user_id != null) {
        const embed = msg_id_embed.embed;
        const emojis = Array.from(embed_get_distinct_available_emojis(embed));
        if (emojis.length == 0) {
            await message.channel.send(`❌ **${embed.title}**: There's no available role!`);
            return;
        }
        const questionRole =
`👤 Please choose an available role:

${emojis.map((elt, idx) => `\`${idx + 1}.\`    ${elt}`).join('\n')}
`;
        const questionRoleEmbed = new Discord.MessageEmbed().setTitle('Choose role').setDescription(questionRole);

        const filter = filter_number(message.channel, message.author.id, 1, emojis.length, messages_to_delete);
        await message.channel.send(questionRoleEmbed)
        .then(async choose_role_message => {
            messages_to_delete.push(choose_role_message);
            await message.channel.awaitMessages(filter, { max: 1 })
            .then(async replies => {
                const reply = replies.first();
                const emoji_idx = parseInt(reply.content.trim());
                const emoji_name = emojis[emoji_idx - 1];

                const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
                await update_user_to_roster(message.client, run_msg, player_user_id, emoji_name);
                await bulkDelete(message.channel, messages_to_delete);
            });
        });
    }
}

async function message_remove_player(message, msg_id_embed, player_user_id) {
    if (player_user_id != null) {
        const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
        await remove_user_from_roster(message.client, run_msg, player_user_id, '❌');
    }
}

async function reset_reactions(run_msg, embed) {
    const roles = Array.from(embed_get_distinct_roles(embed));
    await run_msg.reactions.removeAll();
    try {
        for (let emoji of roles.concat(['🕒', '📝', '❌'])) {
            // Abort if roles changed in the middle of reset_reactions
            const roles_now = Array.from(embed_get_distinct_roles(embed));
            if (JSON.stringify(roles) != JSON.stringify(roles_now)) {
                return;
            }
            await run_msg.react(emoji);
        }
    } catch (exception) {
        // Message can't be found, might as well exit now
        if (exception.code === 10008) {
            logger.warn('Can\'t react on deleted message');
            return;
        }
        logger.error(exception.stack);
    }
}

async function bulkDelete(channel, messages_to_delete) {
    if (messages_to_delete != null) {
        await channel.bulkDelete(messages_to_delete);
    }
}

function distinct_roles(user_roles) {
    const map = new Map();
    for (const user_role of user_roles) {
        if (!map.has(user_role.emoji)) {
            map.set(user_role.emoji, user_role);
        }
    }
    return Array.from(map.values());
}

async function message_change_role(message, msg_id_embed, player_user_id, new_role, messages_to_delete) {
    if (player_user_id != null) {
        const embed = msg_id_embed.embed;
        const user_roles = embed_get_roles_for_user(embed, player_user_id);
        const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);

        const distinct_user_roles = distinct_roles(user_roles);
        const distinct_roles_before = Array.from(embed_get_distinct_roles(embed));

        if (distinct_user_roles.length == 0) {
            await message.channel.send(`❌ **${embed.title}**: Cannot find any role for <@${player_user_id}>!`);
            await bulkDelete(message.channel, messages_to_delete);
        } else if (distinct_user_roles.length == 1) {
            if (embed_change_role_for_user_and_role(embed, player_user_id, user_roles[0].role, new_role)) {
                const distinct_roles_after = Array.from(embed_get_distinct_roles(embed));
                await run_msg.edit(embed);
                message.channel.send(`✅ **${embed.title}**: <@${player_user_id}>'s role ${clean_role(user_roles[0].role)} has been changed to ${clean_role(new_role)}!`);
                await bulkDelete(message.channel, messages_to_delete);
                if (JSON.stringify(distinct_roles_before) != JSON.stringify(distinct_roles_after)) {
                    await reset_reactions(run_msg, embed);
                }
            } else {
                await message.channel.send(`❌ **${embed.title}**: Failed to change role!`);
                await bulkDelete(message.channel, messages_to_delete);
            }
        } else if (distinct_user_roles.length > 1) {
            const questionRole =
`👤 Please choose a role to update:

${distinct_user_roles.map((elt, idx) => `\`${idx + 1}.\`    ${elt.emoji}`).join('\n')}
`;
            const questionRoleEmbed = new Discord.MessageEmbed().setTitle('Choose role').setDescription(questionRole);

            const filter = filter_number(message.channel, message.author.id, 1, distinct_user_roles.length, messages_to_delete);
            await message.channel.send(questionRoleEmbed)
            .then(async choose_role_message => {
                messages_to_delete.push(choose_role_message);
                await message.channel.awaitMessages(filter, { max: 1 })
                .then(async replies => {
                    const reply = replies.first();
                    const user_role_idx = parseInt(reply.content.trim());
                    const user_role = distinct_user_roles[user_role_idx - 1];

                    if (embed_change_role_for_user_and_role(embed, player_user_id, user_role.role, new_role)) {
                        const distinct_roles_after = Array.from(embed_get_distinct_roles(embed));
                        await run_msg.edit(embed);
                        await message.channel.send(`✅ **${embed.title}**: <@${player_user_id}>'s role ${clean_role(user_role.role)} has been changed to ${clean_role(new_role)}!`);
                        await bulkDelete(message.channel, messages_to_delete);
                        if (JSON.stringify(distinct_roles_before) != JSON.stringify(distinct_roles_after)) {
                            await reset_reactions(run_msg, embed);
                        }
                    } else {
                        await message.channel.send(`❌ **${embed.title}**: Failed to change role!`);
                        await bulkDelete(message.channel, messages_to_delete);
                    }
                });
            });
        }
    }
}

async function message_swap_players(message, msg_id_embed, user_id_1, user_id_2, messages_to_delete) {
    const embed = msg_id_embed.embed;
    const run_msg = await get_message_by_id_from_global_cache(message.client, msg_id_embed.message_id);
    const roles_1 = embed_get_roles_for_user(embed, user_id_1);
    const roles_2 = embed_get_roles_for_user(embed, user_id_2);

    let role_1;
    let role_2;
    if (roles_1.length == 0) {
        await message.channel.send(`❌ **${embed.title}**: <@${user_id_1}> doesn't have any role!`);
        await bulkDelete(message.channel, messages_to_delete);
        return;
    }
    if (roles_2.length == 0) {
        await message.channel.send(`❌ **${embed.title}**: <@${user_id_2}> doesn't have any role!`);
        await bulkDelete(message.channel, messages_to_delete);
        return;
    }
    if (roles_1.length == 1) {
        role_1 = roles_1[0];
    } else if (roles_1.length > 1) {
        const distinct_user_roles_1 = distinct_roles(roles_1);
        const questionRole =
`👤 Please choose <@${user_id_1}>'s role to update:

${distinct_user_roles_1.map((elt, idx) => `\`${idx + 1}.\`    ${elt.emoji}`).join('\n')}
`;
        const questionRoleEmbed = new Discord.MessageEmbed().setTitle('Choose role').setDescription(questionRole);

        const filter = filter_number(message.channel, message.author.id, 1, distinct_user_roles_1.length, messages_to_delete);
        const choose_role_message = await message.channel.send(questionRoleEmbed);
        messages_to_delete.push(choose_role_message);
        const replies = await message.channel.awaitMessages(filter, { max: 1 });
        const reply = replies.first();
        role_1 = distinct_user_roles_1[parseInt(reply.content.trim()) - 1];
    }
    if (roles_2.length == 1) {
        role_2 = roles_2[0];
    } else if (roles_2.length > 1) {
        const distinct_user_roles_2 = distinct_roles(roles_2);
        const questionRole =
`👤 Please choose <@${user_id_2}>'s role to update:

${distinct_user_roles_2.map((elt, idx) => `\`${idx + 1}.\`    ${elt.emoji}`).join('\n')}
`;
        const questionRoleEmbed = new Discord.MessageEmbed().setTitle('Choose role').setDescription(questionRole);

        const filter = filter_number(message.channel, message.author.id, 1, distinct_user_roles_2.length, messages_to_delete);
        const choose_role_message = await message.channel.send(questionRoleEmbed);
        messages_to_delete.push(choose_role_message);
        const replies = await message.channel.awaitMessages(filter, { max: 1 });
        const reply = replies.first();
        role_2 = distinct_user_roles_2[parseInt(reply.content.trim()) - 1];
    }

    embed_swap_roles(embed, user_id_1, role_1.role, user_id_2, role_2.role);
    await run_msg.edit(embed);
    await message.channel.send(`✅ **${embed.title}**: [${role_1.emoji} <@${user_id_1}> and ${role_2.emoji} <@${user_id_2}>] swapped to [${role_1.emoji} <@${user_id_2}> and ${role_2.emoji} <@${user_id_1}>]`);
    await bulkDelete(message.channel, messages_to_delete);
}

async function message_help(message, title, content) {
    await message.client.help(message, title, content);
}

async function get_boards(guild_cache) {
    const boards = await guild_cache.get(BOARDS);
    return boards != null ? boards : {};
}

async function set_boards(guild_cache, boards) {
    await guild_cache.set(BOARDS, boards);
}

async function client_refresh_board(client, guild_cache, guild_id, channel_id) {
    const global_cache = client.getCache('global');
    const boards = await get_boards(guild_cache);
    if (!(channel_id in boards))
        return;

    const channel_board = await client_get_channel(client, guild_cache, CHANNEL_RUN_BOARD);
    let bmessage = null;
    try {
        bmessage = await client.discord_cache.getMessage(channel_board.id, boards[channel_id]);
    } catch (exception) {
        return;
    }

    const runs = [];
    const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
    if (message_map != null && guild_id in message_map && channel_id in message_map[guild_id]) {
        const message_ids = message_map[guild_id][channel_id];

        for (const message_id of message_ids) {
            const embed_from_message = get_embed(message_id);
            const embed_title = embed_from_message.title;

            const full_when = embed_from_message.fields[FIELD_WHEN].name;
            const when = full_when.substring(SERVER_TIME_PREFIX.length);
            const date_time = flexible_parse_date(when);

            runs.push({message_id: message_id, name: embed_title, date_time: date_time});
        }
    }

   const content = runs.length == 0 ? 'Nothing happening' : runs
        .sort((r1, r2) => r1.date_time.valueOf() - r2.date_time.valueOf())
        .map(r => `• **${r.date_time.format('dddd MMMM Do [@] h:mm A')} -** [${r.name}](https://discord.com/channels/${guild_id}/${channel_id}/${r.message_id})`)
        .join('\n\n');

    const description = `Channel: <#${channel_id}>\n\n${content}`;
    const embed = bmessage.embeds[0];
    if (embed.description != description) {
        embed.setDescription(description);
        await bmessage.edit(embed);
        logger.debug(`Refreshed board ${guild_id}/${channel_id}`);
    } else {
        logger.debug(`No need to refresh board ${guild_id}/${channel_id}`);
    }
}

function filter_number(channel, author_id, min_value, max_value, messages_to_delete) {
    return async m => {
        try {
            if (m.author.id != author_id) {
                return false;
            }
            if (messages_to_delete != null) {
                messages_to_delete.push(m);
            }
            const run_idx = parseInt(m.content.trim());
            if (isNaN(run_idx) || run_idx < min_value || run_idx > max_value) {
                const message_invalid = await channel.send(`❌ Invalid choice! Please enter a number between ${min_value} and ${max_value}`);
                if (messages_to_delete != null) {
                    messages_to_delete.push(message_invalid);
                }
                return false;
            }

            return true;
        } catch (exception) {
            logger.error(exception.stack);
            return false;
        }
    };
}

function filter_date(channel, author_id, messages_to_delete) {
    return async m => {
        try {
            if (m.author.id != author_id) {
                return false;
            }

            if (messages_to_delete != null) {
                messages_to_delete.push(m);
            }

            const date_time_str = m.content.trim();
            const date_time = moment.tz(date_time_str, "YYYY-MM-DD HH:mm", true, "Europe/Berlin");
            if (!date_time.isValid()) {
                const message_invalid = await channel.send('❌ Invalid date! Example of accepted format: \`2021-08-25 15:30\`');
                if (messages_to_delete != null) {
                    messages_to_delete.push(message_invalid);
                }
                return false;
            }
            const year_diff = date_time.year() - moment.tz("Europe/Berlin").year();
            if (year_diff < 0 || year_diff > 1) {
                const message_invalid = await channel.send('❌ Year must be either the current year, or next year!');
                if (messages_to_delete != null) {
                    messages_to_delete.push(message_invalid);
                }
                return false;
            }

            return true;
        } catch (exception) {
            logger.error(exception.stack);
            return false;
        }
    };
}

function filter_channel(message, author_id, choice_channels, messages_to_delete) {
    return async m => {
        try {
            if (m.author.id != author_id) {
                return false;
            }
            if (messages_to_delete != null) {
                messages_to_delete.push(m);
            }
            const reply = m.content.trim();
            let match;
            let channel_to;
            if (match = /<#(\d+)>/.exec(reply)) {
                const channel_to_id = match[1];
                try {
                    channel_to = await message_get_channel_by_id(message, channel_to_id);
                } catch (exception) {
                    channel_to = null;
                }
            } else {
                const channel_to_idx = parseInt(reply);
                if (isNaN(channel_to_idx) || channel_to_idx <= 0 || channel_to_idx > choice_channels.length) {
                    const message_invalid = await message.channel.send(`❌ Invalid choice! Please enter a number between 1 and ${choice_channels.length}, or enter a #channel`);
                    if (messages_to_delete != null) {
                        messages_to_delete.push(message_invalid);
                    }
                    return false;
                }
                channel_to = choice_channels[channel_to_idx - 1];
            }
            if (channel_to == null) {
                const message_invalid = await message.channel.send(`❌ Cannot access channel ${reply}. Please provide a channel that the bot can view and write.`);
                if (messages_to_delete != null) {
                    messages_to_delete.push(message_invalid);
                }
                return false;
            }

            return true;
        } catch (exception) {
            logger.error(exception.stack);
            return false;
        }
    };
}

function timeout_function(channel, user_id) {
    return async exception => {
        if (exception instanceof Error) {
            throw exception;
        } else {
            await channel.send(`❌ ${user_id == null ? '' : '<@' + user_id +'> '}Command timed out! 🐢`);
        }
    };
}

module.exports = {
    name: 'run',
    description: 'Utilities for organizing runs',
    async setup(client) {
        const global_cache = client.getCache('global');
        const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
        if (message_map == null) {
            return;
        }

        const messages_to_cleanup = [];
        for (const guild_id in message_map) {
            const guild = await client.discord_cache.getGuild(guild_id);
            for (const channel_id in message_map[guild_id]) {
                const channel = await client.discord_cache.getChannel(channel_id);
                for (let message_id_idx in message_map[guild_id][channel_id]) {
                    const message_id = message_map[guild_id][channel_id][message_id_idx];
                    try {
                        const run_message = await client.discord_cache.getMessage(channel_id, message_id);
                        global_embeds.set(run_message.id, run_message.embeds[0]);
                        // Process reactions that happened during downtime
                        // No await here, we don't want to block execution
                        process_reactions(client, run_message).catch((exception) => logger.error(exception.stack));
                    } catch (exception) {
                        if (exception.code === 10008) {
                            // Remove from cache if not found
                            messages_to_cleanup.push({ guild_id: guild_id, channel_id: channel_id, message_id: message_id });
                            logger.info(`setup: Message ${guild_id}/${channel_id}/${message_id} not found! Removing from cache`);
                        } else {
                            logger.error(exception.stack);
                        }
                    }
                }
            }
        }

        if (messages_to_cleanup.length > 0) {
            for (const m of messages_to_cleanup) {
                const message_id_idx = message_map[m.guild_id][m.channel_id].indexOf(m.message_id);
                message_map[m.guild_id][m.channel_id].splice(message_id_idx, 1);
            }
            await global_cache.set(GLOBAL_MESSAGE_MAP, message_map);
        }

        // refresh board after global_embed is set
        for (const guild_id in message_map) {
            const guild_cache = client.getCache(guild_id);
            for (const channel_id in message_map[guild_id]) {
                await client_refresh_board(client, guild_cache, guild_id, channel_id);
            }
        }

        setInterval(async function() {
            await update_all_runs(client);
        }, 60000);
    },
    async onReaction(reaction, user) {
        if (user.bot) { return; }
        if (global_embeds.has(reaction.message.id)) {
            if (reaction.message.partial) await reaction.message.fetch();
            if (reaction.partial) await reaction.fetch();
            logger.info(`onReaction: ${user.id} reacted ${reaction.emoji.toString()} on msg ${reaction.message.id}`);

            await process_reaction(reaction, user);
        }
    },
    async execute(message, args) {
        const PREFIX = await message.client.getPrefix(message.guild.id);

        const guild_cache = message.client.getCache(message.guild.id);

        if (args[0] === 'help') {
            const command = (args.length > 1) ? args[1] : null;
            if (command == null) {
                message_help(message, `${PREFIX}run`,
`Organize instances.

Available \`${PREFIX}run\` commands:
\`\`\`
Admin/Setup:
- set-template-channel
- set-archives-channel
- set-board-channel
- forget-channel
- add-board
- remove-board
- add-role-mention
- remove-role-mention

Organizing party:
- new
- ping
- note
- set-roster
- set-datetime
- add-reminder
- clear-reminders
- when
- add
- remove
- char
- change-role
- swap
- end
\`\`\`
Type \`${PREFIX}run help COMMAND\` with the command of your choice for more info.`
                );
            } else if (command === 'set-template-channel') {
                message_help(message, `${PREFIX}run set-template-channel #channel`,
`Set the channel where template will be written.
Template messages must follow this particular format:
- The first line is the name of the template
- The line for a role that can be picked **MUST** start by an emoji
- Do not use one of those emojis: 🕒 📝 ❌ as they're used by the bot for additional options.

Example:
\`\`\`${PREFIX}run set-template-channel #templates\`\`\`

Example of a (small) template:

LK ET 3 players only

🏇 LK -
🏇 LK -
✝️ HP -
`
                );
            } else if (command === 'set-archives-channel') {
                message_help(message, `${PREFIX}run set-archives-channel #channel`,
`Set the channel where closed runs will be archived.

Example:
\`\`\`${PREFIX}run set-archives-channel #archives\`\`\`
`);
            } else if (command === 'new') {
                message_help(message, `${PREFIX}run new _RUN NAME_`,
`Create a new run named _RUN NAME_.

Example:
\`\`\`${PREFIX}run new LK ET 2021-08-05\`\`\`

You'll then be asked to input the following:
- Which template to use (enter the number corresponding to the desired template)
- The date and time of the event, **SERVER TIME**, format YYYY-MM-DD HH:mm (Example: 2021-08-05 16:30)
- The channel where the roster message will be posted, or a number corresponding to an existing channel. (Example: #roster)
- The role or mention to ping (enter the number corresponding to the desired role/mention)

⚠️ IMPORTANT
The channel on which the run is created will be the only channel able to interact with that particular run.
For example, if you create the new run from #runs to be posted on #roster, you will see the bot message on #roster.
However, you will only be able to run commands such as \`${PREFIX}run add @user\` from #runs and #runs **ONLY**!
`);
            } else if (command === 'add') {
                message_help(message, `${PREFIX}run add <@user>`,
`Add someone to the roster.

Example:
\`\`\`${PREFIX}run add @Hatfun\`\`\`
You'll then be asked to input the following:
- If your channel is linked to multiple rosters, which one to add the player
- Which emoji to assign that player`
);
            } else if (command === 'remove') {
                message_help(message, `${PREFIX}run remove <@user>`,
`Remove someone from the roster.

Example:
\`\`\`${PREFIX}run remove @Hatfun\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to remove the player.
`);
            } else if (command === 'char') {
                message_help(message, `${PREFIX}run char <@user>`,
`Set someone's char name.

Example:
\`\`\`${PREFIX}run char @Hatfun\`\`\`
You'll then be asked to input the following:
- If your channel is linked to multiple rosters, which one to add the player
- Char name for player roles, one at a time`
);
            } else if (command === 'ping') {
                message_help(message, `${PREFIX}run ping <MULTILINE MESSAGE>`,
`Ping every players involved in a run.

Example:
\`\`\`${PREFIX}run ping
Hello!
I'll be online a few minutes late. But my char is ready!
So get prepared and we'll go as soon as I'm online! 🙂
\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to ping.
`);
            } else if (command === 'note') {
                message_help(message, `${PREFIX}run note <MULTILINE MESSAGE>`,
`Add a note to the roster message.

Example:
\`\`\`${PREFIX}run note
CWPs will be provided thanks to our beloved sponsor @Hatfun \\o/
\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to add note.
`);
            } else if (command === 'set-roster') {
                message_help(message, `${PREFIX}run set-roster <MULTILINE MESSAGE>`,
`Replace the entire content of the roster (and players).

Example:
\`\`\`${PREFIX}run set-roster
🏇 LK: @Hatfun [Hatfun]
✝️ HP:
✝️ HP:
\`\`\`
Any role that can be picked **MUST** start by an emoji!
If your channel is linked to multiple rosters, you'll then be asked to input which one to set roster.
`);
            } else if (command === 'set-datetime') {
                message_help(message, `${PREFIX}run set-datetime <datetime>`,
`Resets the date and time of the event.
The date and time of the event should be specified as **SERVER TIME**, format YYYY-MM-DD HH:mm (Example: 2021-08-05 04:00)

Example:
\`\`\`${PREFIX}run set-datetime 2021-08-06 18:30\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to set date and time.
`);
            } else if (command === 'add-reminder') {
                message_help(message, `${PREFIX}run add-reminder <REMINDER>`,
`Set a reminder, so the bot will automatically ping all players of a roster at a specific time.
<REMINDER> has to follow the format \`NUMBER [days|hours|minutes] before\`

Examples:
\`\`\`${PREFIX}run add-reminder 2 days before
${PREFIX}run add-reminder 2 hours before
${PREFIX}run add-reminder 90 minutes before
${PREFIX}run add-reminder 2 days 3 hours before
${PREFIX}run add-reminder 1 day 12 hours before
${PREFIX}run add-reminder 1 hour 30 minutes before
\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to set date and time.
`);
            } else if (command === 'clear-reminders') {
                message_help(message, `${PREFIX}run clear-reminders`,
`Clear all reminders of a run.

Example:
\`\`\`${PREFIX}run clear-reminders\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to set date and time.
`);
            } else if (command === 'when') {
                message_help(message, `${PREFIX}run when`,
`Displays the time of the run for a specific time zone.

Example:
\`\`\`${PREFIX}run when\`\`\`
You'll then be asked to input the following:
- If your channel is linked to multiple rosters, which one to display time
- Which time zone. Enter a number from the prompted list of time zones.
`);
            } else if (command === 'end') {
                message_help(message, `${PREFIX}run end`,
`Close a run.

Example:
\`\`\`${PREFIX}run end\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to set date and time.

Closed run messages will be moved to the #archive channel specified by \`${PREFIX}run set-archives-channel #channel\`
`);
            } else if (command === 'forget-channel') {
                message_help(message, `${PREFIX}run forget-channel`,
`Forget a channel so it's no longer proposed as an option when creating new runs.
A channel can only be forgotten if there's no ongoing run posted on that channel.

Example:
\`\`\`${PREFIX}run forget-channel #roster\`\`\`
`);
            } else if (command === 'set-board-channel') {
                message_help(message, `${PREFIX}run set-board-channel #channel`,
`Set the channel where board will be displayed.

Example:
\`\`\`${PREFIX}run set-board-channel #board\`\`\`
`);
            } else if (command === 'add-board') {
                message_help(message, `${PREFIX}run add-board #channel NAME`,
`Add a board to the board channel that keeps track of all the events posted on roster channel #channel.
NAME will be used as the title of the board.

Example:
\`\`\`${PREFIX}run add-board #et-roster Endless Tower\`\`\`
`);
            } else if (command === 'remove-board') {
                message_help(message, `${PREFIX}run remove-board #channel`,
`Remove the board of roster channel #channel from the board channel.

Example:
\`\`\`${PREFIX}run remove-board #et-roster\`\`\`
`);
            } else if (command === 'change-role') {
                message_help(message, `${PREFIX}run change-role [@user] <emoji and name>`,
`Update the line up to change the signed up role of @user into a new role <emoji and name>. The new role MUST start with an emoji.
If @user is not provided, the sender of the command will be used as user.

Examples:
\`\`\`${PREFIX}run change-role 🔫 GS
${PREFIX}run change-role @Hatfun 🔫 GS
\`\`\`
If your channel is linked to multiple rosters, you'll then be asked to input which one to set date and time.
`);
            } else if (command === 'swap') {
                message_help(message, `${PREFIX}run swap <@user_1> <@user_2>`,
`Update the line up to change the signed up role of @user into a new role <emoji and name>. The new role MUST start with an emoji.
If @user is not provided, the sender of the command will be used as user.

Example:
\`\`\`${PREFIX}run swap @Hatfun @Sleepy\`\`\`
You might then be asked to input the following:
- If your channel is linked to multiple rosters, which one to display time
- If the users signed up for multiple roles, which role should be swapped
`);
            } else if (command === 'add-role-mention') {
                message_help(message, `${PREFIX}run add-role-mention @role`,
`Add a role to the list of roles/mentions that can be pinged when you create a new run.

Example:
\`\`\`${PREFIX}run add-role-mention @EndlessTowerRole\`\`\`
`);
            } else if (command === 'remove-role-mention') {
                message_help(message, `${PREFIX}run remove-role-mention @role`,
`Remove a role from the list of roles/mentions that can be pinged when you create a new run.

Example:
\`\`\`${PREFIX}run remove-role-mention @EndlessTowerRole\`\`\`
`);
            }
        } else if (args[0] === 'set-template-channel') {
            if (args[1] == null) {
                await message.channel.send(`❌ Please provide a template channel. Usage: \`${PREFIX}run set-template-channel #channel\``);
                return;
            }
            const channel_id = args[1].slice(2, -1);

            try {
                const channel = await message.client.discord_cache.getChannel(channel_id);
                await message.guild.roles.fetch();

                if (!channel.permissionsFor(message.client.user).has("VIEW_CHANNEL")) {
                    await message.channel.send(`❌ Bot doesn't have access to channel ${args[1]}!`);
                    return;
                }

                await guild_cache.set(CHANNEL_TEMPLATE, channel.id);
                await message.channel.send(`✅ Successfully set template channel to <#${channel.id}>`);
            } catch (exception) {
                if (exception.code === 50001) {
                    await message.channel.send(`❌ Bot doesn't have access to channel ${args[1]}!`);
                    return;
                } else {
                    throw exception;
                }
            }

        } else if (args[0] === 'set-archives-channel') {
            if (args[1] == null) {
                await message.channel.send(`❌ Please provide a archives channel. Usage: \`${PREFIX}run set-archives-channel #channel\``);
                return;
            }
            const channel_id = args[1].slice(2, -1);

            try {
                const channel = await message.client.discord_cache.getChannel(channel_id);
                await message.guild.roles.fetch();
                if (!channel.permissionsFor(message.client.user).has("VIEW_CHANNEL")) {
                    await message.channel.send(`❌ Bot doesn't have access to channel ${args[1]}!`);
                    return;
                }
                await guild_cache.set(CHANNEL_RUN_ARCHIVES, channel.id);
                await message.channel.send(`✅ Successfully set archives channel to <#${channel.id}>`);
            } catch (exception) {
                if (exception.code === 50001) {
                    await message.channel.send(`❌ Bot doesn't have access to channel ${args[1]}!`);
                    return;
                } else {
                    throw exception;
                }
            }
        }  else if (args[0] === 'set-board-channel') {
            if (args[1] == null) {
                await message.channel.send(`❌ Please provide a board channel. Usage: \`${PREFIX}run set-board-channel #channel\``);
                return;
            }
            const channel_id = args[1].slice(2, -1);

            try {
                const channel = await message.client.discord_cache.getChannel(channel_id);
                await message.guild.roles.fetch();
                if (!channel.permissionsFor(message.client.user).has("VIEW_CHANNEL")) {
                    await message.channel.send(`❌ Bot doesn't have access to channel ${args[1]}!`);
                    return;
                }
                await guild_cache.set(CHANNEL_RUN_BOARD, channel.id);
                await message.channel.send(`✅ Successfully set board channel to <#${channel.id}>`);
            } catch (exception) {
                if (exception.code === 50001) {
                    await message.channel.send(`❌ Bot doesn't have access to channel ${args[1]}!`);
                    return;
                } else {
                    throw exception;
                }
            }
        } else if (args[0] === 'new') {
            if (!await message_validate_channels(message, guild_cache, PREFIX)) { return; }
            const run_name = args[1];
            if (run_name === undefined) {
                await message.channel.send(`❌ Please provide a name. Usage: \`${PREFIX}run new RUN NAME\``);
                return;
            }
            if (is_user_busy(message.author.id, message.guild.id, message.channel.id)) { return; }
            set_user_busy(message.author.id, message.guild.id, message.channel.id);

            const templates = await message_get_template_list(message, guild_cache);
            if (templates == null) { return; }
            const questionTemplate =
`📄 Please choose a template for **${run_name}**:

${templates.map((elt, idx) => `\`${idx + 1}.\` ${elt.title}`).join('\n')}
`;
            const questionTemplateEmbed = new Discord.MessageEmbed().setTitle('New run').setDescription(questionTemplate);
            const messages_to_delete = [];
            const template_number_filter = filter_number(message.channel, message.author.id, 1, templates.length, messages_to_delete);
            await message.channel.send(questionTemplateEmbed)
            .then(async choose_template_message => {
                messages_to_delete.push(choose_template_message);
                await message.channel.awaitMessages(template_number_filter, { max: 1, time: TIMEOUT_MS, errors: ['time'] })
                .then(async c1 => {
                    const template = templates[parseInt(c1.first().content) - 1];
                    const questionDateTime = `🕒 When is **${run_name}** going to happen Server Time?\n(YYYY-MM-DD HH:mm)`;
                    const questionDateTimeEmbed = new Discord.MessageEmbed().setTitle('Date & Time').setDescription(questionDateTime);
                    const date_filter = filter_date(message.channel, message.author.id, messages_to_delete);
                    await message.channel.send(questionDateTimeEmbed)
                    .then(async input_date_message => {
                        messages_to_delete.push(input_date_message);
                        await message.channel.awaitMessages(date_filter, { max: 1, time: TIMEOUT_MS, errors: ['time'] })
                        .then(async c2 => {
                            const date_time_str = c2.first().content;
                            const date_time = moment.tz(date_time_str, "YYYY-MM-DD HH:mm", true, "Europe/Berlin");

                            const global_cache = message.client.getCache('global');
                            const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
                            const choice_channels = [];
                            if (message_map != null && message.guild.id in message_map) {
                                const channel_ids = Object.keys(message_map[message.guild.id]);
                                for (const ch_id of channel_ids) {
                                    const c = await message_get_channel_by_id(message, ch_id);
                                    choice_channels.push(c);
                                }
                            }
                            choice_channels.sort((ch1, ch2) => ch1.name.localeCompare(ch2.name));
                            let questionChannel = `📰 Please provide a channel where **${run_name}** will be posted.`;
                            if (choice_channels.length > 0) {
                                const channel_choices = choice_channels.map((elt, idx) => `\`${idx + 1}.\` <#${elt.id}>`).join('\n');
                                questionChannel += `\n\nChoose an already used destination channel, or enter a new one.\n\n${channel_choices}`;
                            }

                            const questionChannelEmbed = new Discord.MessageEmbed().setTitle('Run channel').setDescription(questionChannel);
                            const channel_filter = filter_channel(message, message.author.id, choice_channels, messages_to_delete);
                            await message.channel.send(questionChannelEmbed)
                            .then(async choose_channel_message => {
                                messages_to_delete.push(choose_channel_message);
                                await message.channel.awaitMessages(channel_filter, { max: 1, time: TIMEOUT_MS, errors: ['time'] })
                                .then(async c3 => {
                                    const reply = c3.first().content.trim();
                                    let match;
                                    let channel_to;
                                    if (match = /<#(\d+)>/.exec(reply)) {
                                        channel_to = await message_get_channel_by_id(message, match[1]);
                                    } else {
                                        channel_to = choice_channels[parseInt(reply) - 1];
                                    }

                                    for (const c of choice_channels) {
                                        for (const msg_id of message_map[message.guild.id][c.id]) {
                                            const embed = get_embed(msg_id);
                                            if (embed.title === run_name) {
                                                set_user_free(message.author.id, message.guild.id, message.channel.id);
                                                await message.channel.send(`❌ A run named '${run_name}' already exists! Please re-run the !run new command with a different name.`);
                                                await bulkDelete(message.channel, messages_to_delete);
                                                return;
                                            }
                                        }
                                    }

                                    let questionRolePing = `📢 Please provide a @mention or @role to notify about **${run_name}**.\n\n`;
                                    const role_mentions = await get_role_mentions(guild_cache);
                                    const role_pings = ['No mention', '@here', '@everyone'].concat(role_mentions);

                                    const role_ping_choices = role_pings.map((elt, idx) => `\`${idx}.\` ${elt}`).join('\n');
                                    questionRolePing += role_ping_choices;

                                    const questionRole = new Discord.MessageEmbed().setTitle('Mention').setDescription(questionRolePing);
                                    const role_filter = filter_number(message.channel, message.author.id, 0, role_pings.length - 1, messages_to_delete);
                                    await message.channel.send(questionRole)
                                    .then(async choose_role_ping_message => {
                                        messages_to_delete.push(choose_role_ping_message);
                                        await message.channel.awaitMessages(role_filter, { max: 1, time: TIMEOUT_MS, errors: ['time'] })
                                        .then(async c4 => {
                                            const role_idx = parseInt(c4.first().content);
                                            const role_ping = role_idx == 0 ? '' : role_pings[role_idx];
                                            await message_create_new_run(message, guild_cache, run_name, date_time, template, message.channel, channel_to, role_ping, messages_to_delete);
                                        }).catch(timeout_function(message.channel, message.author.id));
                                    });
                                }).catch(timeout_function(message.channel, message.author.id));
                            });
                        }).catch(timeout_function(message.channel, message.author.id));
                    });
                }).catch(timeout_function(message.channel, message.author.id));
            }).finally(() => set_user_free(message.author.id, message.guild.id, message.channel.id));
        } else if (args[0] === 'set-roster') {
            if (args[1] == null) {
                await message.channel.send(`❌ No roster provided. Usage: \`${PREFIX}run roster MULTILINE ROSTER\``);
                return;
            }
            const roster = '\u200B\n' + args[1] + '\n\u200B';
            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to set roster!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_update_roster(message, msg_id_embed, roster, []);
            } else {
                const questionRun =
`📄 Please choose a run to apply this roster:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Set roster').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_update_roster(message, msg_id_embed, roster, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'ping') {
            const ping_message = args[1];
            if (ping_message == null) {
                await message.channel.send(`❌ No message provided. Usage: \`${PREFIX}run ping MULTILINE MESSAGE\``);
                return;
            }

            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to ping players!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_ping(message, msg_id_embed.embed, ping_message);
            } else {
                const questionRun =
`📢 Please choose a run to ping players:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Ping').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_ping(message, msg_id_embed.embed, ping_message);
                        await bulkDelete(message.channel, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'set-datetime') {
            const date_time_str = args[1];
            const date_time = moment.tz(date_time_str, "YYYY-MM-DD HH:mm", true, "Europe/Berlin");
            if (!date_time.isValid()) {
                await message.channel.send('❌ Invalid date! Example of accepted format: \`2021-08-25 15:30\`');
                return;
            }
            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to set the date and time!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_update_datetime(message, guild_cache, msg_id_embed, date_time);
            } else {
                const questionRun =
`📄 Please choose a run to apply this date and time:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Set date and time').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_update_datetime(message, guild_cache, msg_id_embed, date_time);
                        await bulkDelete(message.channel, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'note') {
            const note = args[1];
            if (note == null) {
                await message.channel.send(`❌ No note provided. Usage: \`${PREFIX}run note MULTILINE MESSAGE\``);
                return;
            }

            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to set note!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_update_note(message, msg_id_embed, note);
            } else {
                const questionRun =
`📄 Please choose a run to apply this note:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Set note').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_update_note(message, msg_id_embed, note);
                        await bulkDelete(message.channel, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'add-reminder') {
            const reminder_str = args[1];
            if (reminder_str == null) {
                await message.channel.send(`❌ Reminder missing!\nUsage: \`${PREFIX}run add-reminder REMINDER\`
Supported format: \`[NUMBER days] [NUMBER hours] [NUMBER minutes] before\`
Examples:
- \`2 days before\`
- \`12 hours before\`
- \`90 minutes before\`
- \`2 days 3 hours before\`
- \`1 day 12 hours before\`
- \`1 hour 30 minutes before\`
`);
                return;
            }
            const reminder_minutes = parse_reminder(reminder_str);
            if (reminder_minutes == null) {
                await message.channel.send(`❌ **${embed.title}**: Invalid reminder ${reminder_str}!
Supported format: \`[NUMBER days] [NUMBER hours] [NUMBER minutes] before\`
Examples:
- \`2 days before\`
- \`12 hours before\`
- \`90 minutes before\`
- \`2 days 3 hours before\`
- \`1 day 12 hours before\`
- \`1 hour 30 minutes before\`
`);
                return;
            }

            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to add reminder!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_add_reminder(message, msg_id_embed, reminder_minutes);
            } else {
                const questionRun =
`📄 Please choose a run to apply this reminder:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Add reminder').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_add_reminder(message, msg_id_embed, reminder_minutes);
                        await bulkDelete(message.channel, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'end') {
            if (!await message_validate_channels(message, guild_cache, PREFIX)) { return; }

            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);
            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to end!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_end_run(message, guild_cache, msg_id_embed);
            } else {
                const questionRun =
`📄 Please choose a run to end:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('End').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_end_run(message, guild_cache, msg_id_embed);
                        await bulkDelete(message.channel, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'clear-reminders') {
            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);
            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to clear reminders!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_clear_reminders(message, msg_id_embed);
            } else {
                const questionRun =
`📄 Please choose a run to clear reminders:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Clear reminders').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_clear_reminders(message, msg_id_embed);
                        await bulkDelete(message.channel, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'add') {
            let match;
            if ((match = /<@[!]?(\d+)>/.exec(args[1])) == null) {
                await message.channel.send(`❌ Usage \`${PREFIX}run add @user\``);
                return;
            }
            const player_user_id = match[1];
            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to add player!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_add_player(message, msg_id_embed, player_user_id, []);
            } else {
                const questionRun =
`📄 Please choose a run to add this player:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Add player').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_add_player(message, msg_id_embed, player_user_id, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'remove') {
            let match;
            if ((match = /<@[!]?(\d+)>/.exec(args[1])) == null) {
                await message.channel.send(`❌ Usage ${PREFIX}run remove @user`);
                return;
            }
            const player_user_id = match[1];
            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to remove player!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_remove_player(message, msg_id_embed, player_user_id);
            } else {
                const questionRun =
`📄 Please choose a run to remove this player:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Remove player').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_remove_player(message, msg_id_embed, player_user_id);
                        await bulkDelete(message.channel, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'when') {
            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to display date and time!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await show_when(msg_id_embed.message_id, message.author.id, message.channel, true, []);
            } else {
                const questionRun =
`📄 Please choose a run to display date and time:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('When').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await show_when(msg_id_embed.message_id, message.author.id, message.channel, true, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'forget-channel') {
            let match;
            if (args[1] == null || (match = /<#(\d+)>/.exec(args[1])) == null) {
                await message.channel.send(`❌ Please provide a channel to delete. Usage: \`${PREFIX}run forget-channel #channel\``);
                return;
            }
            const channel_id = match[1];

            const global_cache = message.client.getCache('global');
            const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
            const choice_channels = [];

            const guild_id = message.guild.id;

            if (message_map != null && guild_id in message_map && channel_id in message_map[guild_id]) {
                if (message_map[guild_id][channel_id].length > 0) {
                    await message.channel.send(`❌ The channel <#${channel_id}> still have some ongoing runs! Cannot forget!`);
                    return;
                } else {
                    delete message_map[guild_id][channel_id];
                    await global_cache.set(GLOBAL_MESSAGE_MAP, message_map);
                }
            }
            await message.channel.send(`✅ The channel <#${channel_id}> will no longer be used for channel choices`);
        }  else if (args[0] === 'char') {
            let match;
            if ((match = /<@[!]?(\d+)>/.exec(args[1])) == null) {
                await message.channel.send(`❌ Usage \`${PREFIX}run char @user\``);
                return;
            }
            const player_user_id = match[1];
            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to set player char name!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await update_char_name_to_roster_by_message_id(message.client, msg_id_embed.message_id, player_user_id, message.channel, message.author, []);
            } else {
                const questionRun =
`📄 Please choose a run to set this player's char name:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Add player').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await update_char_name_to_roster_by_message_id(message.client, msg_id_embed.message_id, player_user_id, message.channel, message.author, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'add-board') {
            if (!message_validate_board_channel(message, guild_cache, PREFIX)) {
                return;
            }
            let match = null;
            if (args[1] == null || (match = /^<#(\d+)>\s+(.*)$/.exec(args[1])) == null) {
                await message.channel.send(`❌ Usage: \`${PREFIX}run add-board <#channel> <name>\``);
                return;
            }
            const channel_id = match[1];
            const title = match[2].trim();

            const channel_board = await client_get_channel(message.client, guild_cache, CHANNEL_RUN_BOARD);
            const global_cache = message.client.getCache('global');

            const boards = await get_boards(guild_cache);
            if (boards[channel_id] != null) {
                try {
                    const bmessage = await message.client.discord_cache.getMessage(channel_board.id, boards[channel_id]);
                    if (bmessage != null) {
                        await message.channel.send(`❌ Board has already been set up for <#${channel_id}>`);
                        return;
                    }
                } catch (exception) {
                }
            }

            const runs = [];
            const message_map = await global_cache.get(GLOBAL_MESSAGE_MAP);
            if (message_map != null && message.guild.id in message_map && channel_id in message_map[message.guild.id]) {
                const message_ids = message_map[message.guild.id][channel_id];

                for (const message_id of message_ids) {
                    const embed_from_message = get_embed(message_id);
                    const embed_title = embed_from_message.title;

                    const full_when = embed_from_message.fields[FIELD_WHEN].name;
                    const when = full_when.substring(SERVER_TIME_PREFIX.length);
                    const date_time = flexible_parse_date(when);

                    runs.push({message_id: message_id, name: embed_title, date_time: date_time});
                }
            }
            const content = runs.length == 0 ? 'Nothing happening' : runs
                .sort((r1, r2) => r1.date_time.valueOf() - r2.date_time.valueOf())
                .map(r => `• **${r.date_time.format('dddd MMMM Do [@] h:mm A')} -** [${r.name}](https://discord.com/channels/${message.guild.id}/${channel_id}/${r.message_id})`)
                .join('\n\n');

            const embed = new Discord.MessageEmbed()
                .setTitle(title)
                .setDescription(`Channel: <#${channel_id}>\n\n${content}`);

            const board_message = await channel_board.send(embed);

            boards[channel_id] = board_message.id;
            await set_boards(guild_cache, boards);
            await message.channel.send(`✅ Board has been successfully set up for <#${channel_id}>!`);
        } else if (args[0] === 'remove-board') {
            if (!message_validate_board_channel(message, guild_cache, PREFIX)) {
                return;
            }
            let match = null;
            if (args[1] == null || (match = /^<#(\d+)>$/.exec(args[1])) == null) {
                await message.channel.send(`❌ Usage: \`${PREFIX}run add-board <#channel>\``);
                return;
            }
            const channel_id = match[1];

            const channel_board = await client_get_channel(message.client, guild_cache, CHANNEL_RUN_BOARD);
            const boards = await get_boards(guild_cache);

            if (boards[channel_id] != null) {
                try {
                    const bmessage = await message.client.discord_cache.getMessage(channel_board.id, boards[channel_id]);
                    if (bmessage != null) {
                        await bmessage.delete();
                    }
                } catch (exception) {
                }
                delete boards[channel_id];
                await set_boards(guild_cache, boards);
                await message.channel.send(`✅ Board has been successfully removed for <#${channel_id}>!`);
            } else {
                await message.channel.send(`✅ Cannot find board for <#${channel_id}>!`);
            }
        } else if (args[0] === 'add-role-mention') {
            if (args[1] == null || /^<@&(\d+)>$/.exec(args[1]) == null) {
                await message.channel.send(`❌ Usage: \`${PREFIX}run add-role-mention <@role>\``);
                return;
            }
            const role = args[1];
            await add_role_mentions(guild_cache, role);
            await message.channel.send(`✅ ${role} will be added to the list of possible roles to mention when creating a new run!`);
        } else if (args[0] === 'remove-role-mention') {
            if (args[1] == null || /^<@&(\d+)>$/.exec(args[1]) == null) {
                await message.channel.send(`❌ Usage: \`${PREFIX}run remove-role-mention <@role>\``);
                return;
            }
            const role = args[1];
            await remove_role_mentions(guild_cache, role);
            await message.channel.send(`✅ ${role} will no longer be listed to the possible roles to mention when creating a new run!`);
        } else if (args[0] === 'change-role') {
            let match;
            if ((match = /^(<@[!]?(\d+)>\s+)?([^\s].*)$/.exec(args[1])) == null) {
                await message.channel.send(`❌ Usage \`${PREFIX}run change-role [@user] <emoji and text>\``);
                return;
            }
            const unicodeRegex = emojiRegex();
            const hasEmoteRegex = /^(<a?:.+?:\d+>).+$/gm

            const player_user_id = match[2] != null ? match[2] : message.author.id;
            const role = match[3].trim();

            let emoji = null;
            if ((match = unicodeRegex.exec(role)) && match.index === 0) {
                emoji = match[0];
            } else if ((match = hasEmoteRegex.exec(role)) && match.index === 0) {
                emoji = match[1];
            }
            if (emoji == null) {
                await message.channel.send(`❌ Role doesn't start with an emoji! Usage \`${PREFIX}run change-role [@user] <emoji and name>\``);
                return;
            }

            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to change player role!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_change_role(message, msg_id_embed, player_user_id, role, []);
            } else {
                const questionRun =
`📄 Please choose a run to change player role:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Change player role').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_change_role(message, msg_id_embed, player_user_id, role, messages_to_delete);
                    });
                });
            }
        } else if (args[0] === 'swap') {
            let match;
            if ((match = /^<@[!]?(\d+)>\s+<@[!]?(\d+)>$/.exec(args[1])) == null) {
                await message.channel.send(`❌ Usage \`${PREFIX}run swap @user1 @user2\``);
                return;
            }
            const user_id_1 = match[1];
            const user_id_2 = match[2];

            // Get the list of runs that is linked to channel
            const msg_id_embeds = get_embeds_linked_to_channel(message.channel.id);

            if (msg_id_embeds.length == 0) {
                await message.channel.send('❌ There\'s no run linked to this channel to swap players!');
            } else if (msg_id_embeds.length == 1) {
                const msg_id_embed = msg_id_embeds[0];
                await message_swap_players(message, msg_id_embed, user_id_1, user_id_2, []);
            } else {
                const questionRun =
`📄 Please choose a run to swap players:

${msg_id_embeds.map((elt, idx) => `\`${idx + 1}.\` ${elt.embed.title}`).join('\n')}
`;
                const questionRunEmbed = new Discord.MessageEmbed().setTitle('Swap players').setDescription(questionRun);

                const messages_to_delete = [];
                const filter = filter_number(message.channel, message.author.id, 1, msg_id_embeds.length, messages_to_delete);
                await message.channel.send(questionRunEmbed)
                .then(async choose_run_message => {
                    messages_to_delete.push(choose_run_message);
                    await message.channel.awaitMessages(filter, { max: 1 })
                    .then(async replies => {
                        const reply = replies.first();
                        const run_idx = parseInt(reply.content.trim());
                        const msg_id_embed = msg_id_embeds[run_idx - 1];
                        await message_swap_players(message, msg_id_embed, user_id_1, user_id_2, messages_to_delete);
                    });
                });
            }
        }
    }
}