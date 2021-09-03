const Discord = require('discord.js-light');
const logger = require('../libs/logger.js')

module.exports = {
    name: 'ps',
    description: 'Keep track of your purchase shops',
    async execute(message, args) {
        const CHANNEL_BUYING = 'ps_buying';
        const CHANNEL_BOUGHT = 'ps_bought';
        const CURRENT_PS = 'ps_current';
        const FORMAT_SPACE = ' ';
        const PREFIX = await message.client.getPrefix(message.guild.id);

        const cache = message.client.getCache(message.guild.id);

        async function validate_channels() {
            let errors = [];
            if (await cache.get(CHANNEL_BUYING) == null) {
                errors.push(`❌ Please set buying channel by typing \`${PREFIX}ps set-buying-channel #channel\``);
            }
            if (await cache.get(CHANNEL_BOUGHT) == null) {
                errors.push(`❌ Please set sold channel by typing \`${PREFIX}ps set-bought-channel #channel\``);
            }
            if (errors.length > 0) {
                message.channel.send(errors);
                return false;
            }
            return true;
        }

        async function validate_current() {
            let errors = [];
            if (await cache.get(CURRENT_PS) == null) {
                errors.push(`❌ Please set current purchase shop by typing \`${PREFIX}ps set-current-ps <name>\``);
            }
            if (errors.length > 0) {
                message.channel.send(errors);
                return false;
            }
            return true;
        }

        async function get_channel(channel_key) {
            return message.guild.channels.cache.get(await cache.get(channel_key));
        }

        async function get_ps_message(user, ps_name = null) {
            const channel = await get_channel(CHANNEL_BUYING);
            const channel_messages = await channel.messages.fetch();
            if (ps_name == null) {
                ps_name = await cache.get(CURRENT_PS);
            }
            const ps_message = channel_messages.find(msg => msg.embeds[0].title.toLowerCase() === ps_name.toLowerCase() && msg.embeds[0].description === `By <@${user.id}>`);
            if (ps_message == undefined) {
                message.channel.send(`❌ Cannot find ${user.username}'s purchase shop **${ps_name}**`);
                return null;
            }
            return ps_message;
        }

        function parse_price(pricestr) {
            let val = 0;
            let tmp_val = 0;
            let tmp_dec = 0;
            let flag_dec = false;
            for (let c of pricestr) {
                if ('0' <= c && c <= '9') {
                    if (flag_dec)
                        tmp_dec = tmp_dec * 10 + parseInt(c);
                    else
                        tmp_val = tmp_val * 10 + parseInt(c);
                } else if (c === 'k') {
                    val += tmp_val * 1000 + parseInt(tmp_dec.toString().padEnd(3, '0'));
                    tmp_val = 0;
                    tmp_dec = 0;
                    flag_dec = false;
                } else if (c === 'm') {
                    val += tmp_val * 1000000 + parseInt(tmp_dec.toString().padEnd(3, '0')) * 1000;
                    tmp_val = 0;
                    tmp_dec = 0;
                    flag_dec = false;
                } else if (c === '.') {
                    flag_dec = true;
                }
            }
            val += tmp_val;

            return val;
        }

        function parse_item(itemstr) {
            itemstr = itemstr.trim();
            let name = null;
            let quantity = null;
            let price = null;
            let match = null;

            if ((match = /^(.+\S)\s+x(\d+)\s+(\d[0-9mk.,]*)z?$/.exec(itemstr)) != null) {
                name = match[1];
                quantity = parseInt(match[2]);
                price = parse_price(match[3]);
            } else if ((match = /^(.+\S)\s+(\d[0-9mk.,]*)z?\s+x(\d+)$/.exec(itemstr)) != null) {
                name = match[1];
                price = parse_price(match[2]);
                quantity = parseInt(match[3]);
            } else if ((match = /^(.+\S)\s+(\d[0-9mk.,]*)z?$/.exec(itemstr)) != null) {
                name = match[1];
                price = parse_price(match[2]);
            } else if ((match = /^(.+\S)\s+x(\d+)$/.exec(itemstr)) != null) {
                name = match[1];
                quantity = parseInt(match[2]);
            } else {
                name = itemstr;
            }

            return { name: name, quantity: quantity, price: price };
        }

        function parse_items(field_value) {
            return (field_value === '```(empty)```' ? [] : field_value.slice(4, -3).split('\n').map(i => parse_item(i)));
        }

        function format_item(item, max_name_length, max_price_length) {
            const price_len = item.price != null ? item.price.toLocaleString().length : 0;
            const price_space_len = max_name_length - item.name.length + 4 + max_price_length - price_len;
            const price = item.price != null ? FORMAT_SPACE.repeat(price_space_len) + item.price.toLocaleString() + "z" : "";
            const quantity_space_len = item.price != null ? 4 : price_space_len + 4 + 1; // + 1 for extra char "z" in price
            const quantity = item.quantity != null ? FORMAT_SPACE.repeat(quantity_space_len) + 'x' + item.quantity : "";

            return `${item.name}${price}${quantity}`;
        }

        function format_items(items) {
            let formatted_items = [];
            const max_name_length = Math.max(...items.map(i => i.name.length));
            const max_price_length = Math.max(...items.map(i => i.price != null ? i.price.toLocaleString().length : 0));
            items.forEach(i => {
                formatted_items.push(format_item(i, max_name_length, max_price_length))
            });
            return formatted_items;
        }

        function format_item_no_price(item, max_name_length) {
            const quantity_space_len = max_name_length - item.name.length + 4;
            const quantity = item.quantity != null ? FORMAT_SPACE.repeat(quantity_space_len) + 'x' + item.quantity : "";

            return `${item.name}${quantity}`;
        }

        function format_items_no_price(items) {
            let formatted_items = [];
            const max_name_length = Math.max(...items.map(i => i.name.length));
            items.forEach(i => {
                formatted_items.push(format_item_no_price(i, max_name_length))
            });
            return formatted_items;
        }

        function format_item_no_quantity(item, max_name_length, max_price_length) {
            const price_len = item.price != null ? item.price.toLocaleString().length : 0;
            const price_space_len = max_name_length - item.name.length + 4 + max_price_length - price_len;
            const price = item.price != null ? FORMAT_SPACE.repeat(price_space_len) + item.price.toLocaleString() + "z" : "";

            return `${item.name}${price}`;
        }

        function format_items_no_quantity(items) {
            let formatted_items = [];
            const max_name_length = Math.max(...items.map(i => i.name.length));
            const max_price_length = Math.max(...items.map(i => i.price != null ? i.price.toLocaleString().length : 0));
            items.forEach(i => {
                formatted_items.push(format_item_no_quantity(i, max_name_length, max_price_length))
            });
            return formatted_items;
        }

        async function update_stats(ps_message, embed, item_to_limit = null) {
            const bought_items = parse_items(embed.fields[1].value);
            const bought_outside_items = parse_items(embed.fields[2].value);
            const all_bought_items = bought_items.concat(bought_outside_items);
            const obtained_items = parse_items(embed.fields[3].value);
            const all_items = obtained_items.concat(all_bought_items);

            function sum_items(items) {
                const result = {};
                items.forEach(item => {
                    if (!(item.name in result)) {
                        result[item.name] = { name: item.name, quantity: 0, price: 0 };
                    }
                    result[item.name].quantity += item.quantity;
                    if (item.price != null) {
                        result[item.name].price += (item.price * item.quantity);
                    }
                });
                return result;
            }
            // Item total
            const total_all_items = sum_items(all_items);
            const total_all_items_arr = Object.values(total_all_items).sort((i1, i2) => { return i1.name.localeCompare(i2.name)});
            if (total_all_items_arr.length === 0) {
                embed.fields[4].value = "```(empty)```";
            } else {
                const total_all_items_arr_str = format_items_no_price(total_all_items_arr).join("\n");
                embed.fields[4].value = "```\n" + total_all_items_arr_str + "```";
            }
            // Check limit
            if (item_to_limit != null) {
                const limited_items = parse_items(embed.fields[5].value);
                const limited_item = limited_items.find(item => item.name === item_to_limit.name);
                if (limited_item != null && total_all_items_arr.some(item => item.name === limited_item.name && item.quantity >= limited_item.quantity)) {
                    await message.channel.send(`🎉 **${embed.title}**: Good job <@${message.author.id}>! You've reached your goal of ${limited_item.quantity} ${limited_item.name}!`);
                }
            }

            // Stats based on bought items
            const total_bought_items = sum_items(all_bought_items);
            const total_bought_items_arr = Object.values(total_bought_items).sort((i1, i2) => { return i1.name.localeCompare(i2.name)});

            if (total_bought_items_arr.length === 0) {
                embed.fields[6].value = "```(empty)```";
            } else {
                const cost_items = [...total_bought_items_arr];
                const cost_total = cost_items.reduce((acc, elt) => {acc.price += elt.price; return acc;}, {name: 'Total', price: 0});
                cost_items.push(cost_total);
                const cost_items_str = format_items_no_quantity(cost_items).map(i_str => {return `- ${i_str}`;}).join("\n");

                const all_avg = total_bought_items_arr.map(item => { return { name: item.name, price: Math.floor(item.price / item.quantity)};});
                const avg_total = all_avg.reduce((acc, elt) => {acc.price += elt.price; return acc;}, {name: 'Total', price: 0});
                all_avg.push(avg_total);
                const all_avg_str = format_items_no_quantity(all_avg).map(i_str => {return `- ${i_str}`;}).join("\n");
                const stats_content =
`Total Buying Cost:
${cost_items_str}

Total Average Cost:
${all_avg_str}`;
                embed.fields[6].value = "```\n" + stats_content + "```";
            }

            ps_message.edit(embed);
        }

        async function help(title, content) {
            await message.client.help(message, title, content);
        }

        if (args == null || args[0] === 'help') {
            const command = (args != null && args.length > 1) ? args[1] : null;
            if (command == null) {
                help(`${PREFIX}ps`,
`Set of commands to manage Purchase Shops and keep track of purchase prices.

Available \`${PREFIX}ps\` commands:
\`\`\`
- set-buying-channel
- set-bought-channel
- new
- set-current-ps
- buying
- set-buying
- bought
- set-bought
- bought-outside
- set-bought-outside
- got
- set-got
- set-limit
- end
\`\`\`
Type \`${PREFIX}ps help COMMAND\` with the command of your choice for more info.`
                );
            } else if (command === 'set-buying-channel') {
                help(`${PREFIX}ps set-buying-channel _#channel_`,
`Keep track of the active purchase shops on the selected channel.

Example:
\`\`\`${PREFIX}ps set-buying-channel #buying-shops\`\`\``
                );
            } else if (command === 'set-bought-channel') {
                help(`${PREFIX}ps set-bought-channel _#channel_`,
`Keep track of the closed purchase shops on the selected channel.

Example:
\`\`\`${PREFIX}ps set-bought-channel #bought-shops\`\`\``
                );
            } else if (command === 'new') {
               help(`${PREFIX}ps new _SHOP NAME_`,
`Create a new purchase shop with name _SHOP NAME_, and sets the current purchase shop to that newly created one.
Purchase shops can be viewed on the buying channel.

Example:
\`\`\`${PREFIX}ps new CWP ingredients 2021-06-18\`\`\``
                );
            } else if (command === 'set-current-ps') {
               help(`${PREFIX}ps set-current-ps _SHOP NAME_`,
`Set the current purchase shop. Name should be matching an existing purchase shop.

Example:
\`\`\`${PREFIX}ps set-current-ps CWP ingredients 2021-06-18\`\`\``
                );
            } else if (command === 'buying') {
               help(`${PREFIX}ps buying <quantity> <item> <unit_price>`,
`Add a buying item to the _Buying_ section of the current purchase shop.
\`<quantity>\`: Item quantity. Supports the following formats: 5500, 5.5k
\`<item>\`: Item name
\`<unit_price>\`: Unit price. Supports the following formats: 5500, 5.5k, 5500z, 5.5kz

Examples:
\`\`\`${PREFIX}ps buying 500 WH 550z
${PREFIX}ps buying 6k WSS 1408z
${PREFIX}ps buying 200 Strawberry 2k
\`\`\``
                );
            } else if (command === 'set-buying') {
               help(`${PREFIX}ps set-buying <MULTILINE LIST OF ITEMS>`,
`Reset the _Buying_ section of the current purchase shop.
\`<MULTILINE LIST OF ITEMS>\`: All items as per the format used in the _Buying_ section.

Example:
\`\`\`${PREFIX}ps set-buying
WH       600z    x100
WSS    1,644z    x500
\`\`\``
                );
            } else if (command === 'bought') {
               help(`${PREFIX}ps bought <quantity> <item>`,
`Deduce some items from the _Buying_ section and mark them as bought in the _Bought_ section.
\`<quantity>\`: Item quantity. Supports the following formats: 5500, 5.5k
\`<item>\`: Item name

Examples:
\`\`\`${PREFIX}ps bought 422 WH
${PREFIX}ps bought 5.5k WSS
${PREFIX}ps bought 200 Strawberry
\`\`\``
                );
            } else if (command === 'set-bought') {
               help(`${PREFIX}ps set-bought <MULTILINE LIST OF ITEMS>`,
`Reset the _Bought_ section of the current purchase shop.
\`<MULTILINE LIST OF ITEMS>\`: All items as per the format used in the _Bought_ section.

Example:
\`\`\`${PREFIX}ps set-bought
WH       502z    x480
WSS    1,200z    x200
\`\`\``
                );
            } else if (command === 'bought-outside') {
               help(`${PREFIX}ps bought-outside <quantity> <item> <unit_price>`,
`Add an item to the _Bought elsewhere_ section of the current purchase shop.
Use it if you want to keep track of purchasing price for an item bought from vend or from another player.
\`<quantity>\`: Item quantity. Supports the following formats: 5500, 5.5k
\`<item>\`: Item name
\`<unit_price>\`: Unit price. Supports the following formats: 5500, 5.5k, 5500z, 5.5kz

Examples:
\`\`\`${PREFIX}ps bought-outside 500 WH 600z
${PREFIX}ps bought-outside 6k WSS 1.6k
${PREFIX}ps bought-outside 200 Strawberry 3k
\`\`\``
                );
            } else if (command === 'set-bought-outside') {
               help(`${PREFIX}ps set-bought-outside <MULTILINE LIST OF ITEMS>`,
`Reset the _Bought elsewhere_ section of the current purchase shop.
\`<MULTILINE LIST OF ITEMS>\`: All items as per the format used in the _Bought elsewhere_ section.

Example:
\`\`\`${PREFIX}ps set-bought-outside
WH       502z    x480
WSS    1,644z    x505
\`\`\``
                );
            } else if (command === 'got') {
               help(`${PREFIX}ps got <quantity> <item>`,
`Add an item to the _Got without buying_ section to keep track of items obtained without buying (drop, gift, ...)
\`<quantity>\`: Item quantity. Supports the following formats: 5500, 5.5k
\`<item>\`: Item name

Examples:
\`\`\`${PREFIX}ps got 3k WH
${PREFIX}ps got 15k WSS
\`\`\``
                );
            } else if (command === 'set-got') {
               help(`${PREFIX}ps set-got <MULTILINE LIST OF ITEMS>`,
`Reset the _Got without buying_ section of the current purchase shop.
\`<MULTILINE LIST OF ITEMS>\`: All items as per the format used in the _Got without buying_ section.

Example:
\`\`\`${PREFIX}ps set-got
WH          x3000
WSS         x15000
\`\`\``
                );
            } else if (command === 'set-limit') {
               help(`${PREFIX}ps set-limit <item> <quantity>`,
`Add an item to the _Limit_ section of the current purchase shop.
You will get notified once the limit of a particular item is reached.
\`<item>\`: Item name
\`<quantity>\`: Item quantity. Supports the following formats: 5500, 5.5k

Examples:
\`\`\`${PREFIX}ps set-limit WH 30k
${PREFIX}ps set-limit WSS 30k
\`\`\``
                );
            } else if (command === 'end') {
               help(`${PREFIX}ps end [_SHOP NAME_]`,
`Mark the purchase shop as ended. Purchase shop will be moved from the #buying channel to the #bought channel.
\`SHOP NAME\` _(Optional)_: If not provided, the current purchase shop will be used.

Examples:
\`\`\`${PREFIX}ps end
${PREFIX}ps end CWP ingredients 2021-06-18\`\`\``
                );
            } else {
                message.channel.send(`❌ Unrecognized command. Check \`${PREFIX}ps help\` for available commands.`)
            }
        } else if (args[0] === 'set-buying-channel') {
            const channel_id = args[1].slice(2, -1);
            const channel = message.guild.channels.cache.get(channel_id);
            await cache.set(CHANNEL_BUYING, channel.id);
            message.channel.send(`✅ Successfully set ${CHANNEL_BUYING} channel to <#${channel.id}>`);
        } else if (args[0] === 'set-bought-channel') {
            const channel_id = args[1].slice(2, -1);
            const channel = message.guild.channels.cache.get(channel_id);
            await cache.set(CHANNEL_BOUGHT, channel.id);
            message.channel.send(`✅ Successfully set bought channel to <#${channel.id}>`);
        } else if (args[0] === 'new' && args.length > 1) {
            if (! await validate_channels())
                return;
            const ps_name = args[1];
            const channel = await get_channel(CHANNEL_BUYING);

            const channel_messages = await channel.messages.fetch()
            const ps_message = channel_messages.find(msg => msg.embeds[0].title.toLowerCase() === ps_name.toLowerCase());
            if (ps_message != undefined) {
                message.channel.send(`❌ Purchase shop ${ps_name} already exists`);
                return;
            }

            const embed = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle(ps_name)
                .setAuthor('Purchase Shop', message.author.displayAvatarURL({format: 'jpg'}))
                .setDescription(`By <@${message.author.id}>`)
                .addFields(
                    { name: 'Buying', value: '```(empty)```', inline: true },
                    { name: 'Bought', value: '```(empty)```', inline: true },
                    { name: 'Bought elsewhere', value: '```(empty)```' },
                    { name: 'Got without buying', value: '```(empty)```' },
                    { name: 'Item total', value: '```(empty)```', inline: true},
                    { name: 'Limit', value: '```(empty)```', inline: true},
                    { name: 'Stats', value: '```(empty)```' },
                )
                .setTimestamp();

            await cache.set(CURRENT_PS, ps_name);
            channel.send(embed);
            message.channel.send(`✅ New purchase shop **${ps_name}** created in <#${channel.id}>`);
            message.channel.send(`✅ Current purchase shop set to **${ps_name}**`);
        } else if (args[0] === 'set-current-ps') {
            if (! await validate_channels())
                return;
            const ps_name = args[1];
            const ps_message = await get_ps_message(message.author, ps_name);
            if (ps_message == null)
                return;

            await cache.set(CURRENT_PS, ps_name);
            message.channel.send(`✅ Current purchase shop set to **${ps_name}**`);
        } else if (args[0] === 'buying') {
            if (! await validate_channels() || ! await validate_current())
                return;
            let match = null;
            if ((match = /^(\d[0-9mk.,]*)\s+(.+)\s+(\d[0-9mk.,]*)z?$/.exec(args[1])) == null) {
                message.channel.send(`❌ Incorrect entry. \`${PREFIX}ps buying <quantity> <item> <price>\``);
                return;
            }
            const quantity = parse_price(match[1]);
            const name = match[2];
            const price = parse_price(match[3]);
            const item = { name: name, quantity: quantity, price: price };

            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];
            const current_items = (embed.fields[0].value === '```(empty)```' ? [] : embed.fields[0].value.slice(4, -3).split('\n').map(i => parse_item(i)));

            const item_to_update = current_items.find(f => f.name.toLowerCase() === item.name.toLowerCase());
            let response = null;
            if (item_to_update === undefined) {
                current_items.push(item);
                current_items.sort((i1, i2) => { return i1.name.localeCompare(i2.name)});
                response = `✅ **${embed.title}**: ${item.name} added! (Quantity: ${item.quantity}, Price: ${item.price}z)`;
            } else {
                item_to_update.quantity = item.quantity;
                item_to_update.price = item.price;
                response = `✅ **${embed.title}**: ${item.name} updated! (Quantity: ${item.quantity}, Price: ${item.price}z)`;
            }

            const formatted_items = format_items(current_items);
            embed.fields[0].value = "```\n" + formatted_items.join('\n') + "```";
            ps_message.edit(embed);
            message.channel.send(response);
        } else if (args[0] === 'set-buying') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];
            const current_items = parse_items("```\n" + args[1] + "```");
            current_items.sort((i1, i2) => { return i1.name.localeCompare(i2.name)});

            const formatted_items = format_items(current_items);
            embed.fields[0].value = "```\n" + formatted_items.join('\n') + "```";
            ps_message.edit(embed);
            message.channel.send(`✅ **${embed.title}**: List of buying items updated!`);
        } else if (args[0] === 'bought') {
            if (! await validate_channels() || ! await validate_current())
                return;
            let match = null;
            if ((match = /^(\d[0-9mk.,]*)\s+(.+)$/.exec(args[1])) == null) {
                message.channel.send(`❌ Incorrect entry. \`${PREFIX}ps bought <quantity> <item>\``);
                return;
            }
            const quantity = parse_price(match[1]);
            const name = match[2];
            const item = { name: name, quantity: quantity, price: null };

            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];
            const current_items = (embed.fields[0].value === '```(empty)```' ? [] : embed.fields[0].value.slice(4, -3).split('\n').map(i => parse_item(i)));

            const item_to_update_idx = current_items.findIndex(mi => mi.name.toLowerCase() === item.name.toLowerCase());
            let response = null;
            if (item_to_update_idx < 0) {
                message.channel.send(`❌ **${embed.title}**: Cannot find corresponding buying item ${item.name}`);
                return;
            }
            const item_to_update = current_items[item_to_update_idx];
            if (item.quantity > item_to_update.quantity) {
                message.channel.send(`❌ **${embed.title}**: Couldn't have bought more than ${item_to_update.quantity} of ${item.name}`);
                return;
            }
            item.price = item_to_update.price;
            item_to_update.quantity -= item.quantity;

            if (item_to_update.quantity == 0) {
                current_items.splice(item_to_update_idx, 1);
            }
            if (current_items.length === 0) {
                embed.fields[0].value = "```(empty)```";
            } else {
                const formatted_items = format_items(current_items);
                embed.fields[0].value = "```\n" + formatted_items.join('\n') + "```";
            }

            const bought_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const bought_item_to_update = bought_items.find(i => i.name.toLowerCase() === item.name.toLowerCase() && i.price === item.price);
            if (bought_item_to_update == null) {
                bought_items.push(item);
            } else {
                bought_item_to_update.quantity += item.quantity;
            }
            bought_items.sort((i1, i2) => { return i1.name === i2.name ? i1.price - i2.price : i1.name.localeCompare(i2.name)});

            embed.fields[1].value = "```\n" + format_items(bought_items).join('\n') + "```";

            await ps_message.edit(embed);

            await update_stats(ps_message, embed, item);

            message.channel.send(`✅ **${embed.title}**: Marked ${item.quantity} ${item.name} to bought items!`);
        } else if (args[0] === 'set-bought') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];
            const current_items = parse_items("```\n" + args[1] + "```");
            current_items.sort((i1, i2) => { return i1.name.localeCompare(i2.name)});

            const formatted_items = format_items(current_items);
            embed.fields[1].value = "```\n" + formatted_items.join('\n') + "```";
            await ps_message.edit(embed);

            await update_stats(ps_message, embed, null);

            message.channel.send(`✅ **${embed.title}**: List of bought items updated!`);
        } else if (args[0] === 'bought-outside') {
            if (! await validate_channels() || ! await validate_current())
                return;
            let match = null;
            if ((match = /^(\d[0-9mk.,]*)\s+(.+)\s+(\d[0-9mk.,]*)z?$/.exec(args[1])) == null) {
                message.channel.send(`❌ Incorrect entry. \`${PREFIX}ps bought-outside <quantity> <item> <price>\``);
                return;
            }
            const quantity = parse_price(match[1]);
            const name = match[2];
            const price = parse_price(match[3]);
            const item = { name: name, quantity: quantity, price: price };

            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];

            const bought_items = parse_items(embed.fields[2].value);
            const bought_item_to_update = bought_items.find(i => i.name.toLowerCase() === item.name.toLowerCase() && i.price === item.price);
            if (bought_item_to_update == null) {
                bought_items.push(item);
            } else {
                bought_item_to_update.quantity += item.quantity;
            }
            bought_items.sort((i1, i2) => { return i1.name === i2.name ? i1.price - i2.price : i1.name.localeCompare(i2.name)});

            embed.fields[2].value = "```\n" + format_items(bought_items).join('\n') + "```";

            await ps_message.edit(embed);

            await update_stats(ps_message, embed, item);

            message.channel.send(`✅ **${embed.title}**: Marked ${item.quantity} ${item.name} (price: ${item.price}z) to items bought outside!`);
        } else if (args[0] === 'set-bought-outside') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];
            const current_items = parse_items("```\n" + args[1] + "```");
            current_items.sort((i1, i2) => { return i1.name.localeCompare(i2.name)});

            const formatted_items = format_items(current_items);
            embed.fields[2].value = "```\n" + formatted_items.join('\n') + "```";
            await ps_message.edit(embed);

            await update_stats(ps_message, embed, null);

            message.channel.send(`✅ **${embed.title}**: List of bought outside items updated!`);
        } else if (args[0] === 'got') {
            if (! await validate_channels() || ! await validate_current())
                return;
            let match = null;
            if ((match = /^(\d[0-9mk.,]*)\s+(.+)$/.exec(args[1])) == null) {
                message.channel.send(`❌ Incorrect entry. \`${PREFIX}ps got <quantity> <item>\``);
                return;
            }
            const quantity = parse_price(match[1]);
            const name = match[2];
            const item = { name: name, quantity: quantity, price: null };

            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];

            const obtained_items = parse_items(embed.fields[3].value);
            const obtained_item_to_update = obtained_items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
            if (obtained_item_to_update == null) {
                obtained_items.push(item);
            } else {
                obtained_item_to_update.quantity += item.quantity;
            }
            obtained_items.sort((i1, i2) => { return i1.name.localeCompare(i2.name)});

            embed.fields[3].value = "```\n" + format_items_no_price(obtained_items).join('\n') + "```";

            await ps_message.edit(embed);

            await update_stats(ps_message, embed, item);

            message.channel.send(`✅ **${embed.title}**: Marked ${item.quantity} ${item.name} as obtained!`);
        } else if (args[0] === 'set-got') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];
            const current_items = parse_items("```\n" + args[1] + "```");
            current_items.sort((i1, i2) => { return i1.name.localeCompare(i2.name)});

            const formatted_items = format_items(current_items);
            embed.fields[3].value = "```\n" + formatted_items.join('\n') + "```";
            await ps_message.edit(embed);

            await update_stats(ps_message, embed, null);

            message.channel.send(`✅ **${embed.title}**: List of obtained items updated!`);
        } else if (args[0] === 'set-limit') {
            if (! await validate_channels() || ! await validate_current())
                return;
            let match = null;
            if ((match = /^(.+)\s+(\d[0-9mk.,]*)$/.exec(args[1])) == null) {
                message.channel.send(`❌ Incorrect entry. \`${PREFIX}ps set-limit <item> <quantity>\``);
                return;
            }
            const name = match[1];
            const quantity = parse_price(match[2]);
            const item = { name: name, quantity: quantity, price: null };

            const ps_message = await get_ps_message(message.author);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];

            const limit_items = parse_items(embed.fields[5].value);
            const limit_item_to_update = limit_items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
            if (limit_item_to_update == null) {
                limit_items.push(item);
            } else {
                limit_item_to_update.quantity = item.quantity;
            }

            embed.fields[5].value = "```\n" + format_items_no_price(limit_items).join('\n') + "```";

            await ps_message.edit(embed);

            message.channel.send(`✅ **${embed.title}**: You will be notified once you reach at least ${item.quantity} ${item.name}!`);
        } else if (args[0] === 'end') {
            if (! await validate_channels() || ! await validate_current())
                return;

            let ps_name = (args.length > 1) ? args[1] : null;
            const ps_message = await get_ps_message(message.author, ps_name);
            if (ps_message == null)
                return;

            const embed = ps_message.embeds[0];
            ps_name = embed.title;

            const confirm_filter = (reaction, user) => { return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id; };
            const confirm_message = await message.channel.send(`:grey_question: Mark **${ps_name}** as finished?`);
            confirm_message.react('✅').then(() => confirm_message.react('❌'));
            confirm_message
                .awaitReactions(confirm_filter, { max: 1, time: 60000, errors: ['time'] })
                .then(async collected => {
                    const reaction = collected.first();

                    if (reaction.emoji.name !== '✅') {
                        message.channel.send('❌ User cancelled');
                        confirm_message.delete();
                    } else {
                        embed.fields[0].value = '```(empty)```';
                        const channel_bought = await get_channel(CHANNEL_BOUGHT);
                        embed
                            .setColor("#009900")
                            .setTimestamp();

                        channel_bought.send(embed);

                        ps_message.delete();
                        message.channel.send(`✅ **${ps_name}** completed!`);
                        confirm_message.delete();
                    }
                })
                .catch(collected => {
                    logger.error(collected);
                    message.channel.send("❌ Action cancelled");
                    confirm_message.delete();
                });
        }
    }
}