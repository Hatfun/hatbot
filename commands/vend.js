const Discord = require('discord.js-light');
const logger = require('../libs/logger.js')

module.exports = {
    name: 'vend',
    description: 'Keep track of items to vend',
    async execute(message, args) {
        const CHANNEL_VENDING = 'vend_vending';
        const CHANNEL_SOLD = 'vend_sold';
        const CURRENT_VENDING = 'vend_current';
        const FORMAT_SPACE = ' ';

        const cache = message.client.getCache(message.guild.id);
        const PREFIX = await message.client.getPrefix(message.guild.id);

        async function validate_channels() {
            let errors = [];
            if (await cache.get(CHANNEL_VENDING) == null) {
                errors.push(`❌ Please set vending channel by typing \`${PREFIX}vend set-vending-channel #channel\``);
            }
            if (await cache.get(CHANNEL_SOLD) == null) {
                errors.push(`❌ Please set sold channel by typing \`${PREFIX}vend set-sold-channel #channel\``);
            }
            if (errors.length > 0) {
                message.channel.send(errors);
                return false;
            }
            return true;
        }

        async function validate_current() {
            let errors = [];
            if (await cache.get(CURRENT_VENDING) == null) {
                errors.push(`❌ Please set current vend by typing \`${PREFIX}vend set-current-vend <name>\``);
            }
            if (errors.length > 0) {
                message.channel.send(errors);
                return false;
            }
            return true;
        }

        async function get_vend_message(user, vend_name = null) {
            const channel = await get_channel(CHANNEL_VENDING);
            const channel_messages = await channel.messages.fetch();
            if (vend_name == null) {
                vend_name = await cache.get(CURRENT_VENDING);
            }
            const vend_message = channel_messages.find(msg => msg.embeds[0].title.toLowerCase() === vend_name.toLowerCase() && msg.embeds[0].description === `By <@${user.id}>`);
            if (vend_message == undefined) {
                message.channel.send(`❌ Cannot find ${user.username}'s vend **${vend_name}**`);
                return null;
            }
            return vend_message;
        }

        async function get_vend_messages_by_item(user, item_name) {
            const channel = await get_channel(CHANNEL_VENDING);
            const channel_messages = await channel.messages.fetch();
            const vend_messages = channel_messages.filter(msg => {
                const embed = msg.embeds[0];
                const current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));

                return embed.description === `By <@${user.id}>` && current_items.some(i => i.name.toLowerCase() === item_name.toLowerCase());
            }).array();

            return vend_messages;
        }

        async function get_channel(channel_key) {
            return message.guild.channels.cache.get(await cache.get(channel_key));
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

        function update_total_sold(embed) {
            const sold_field = embed.fields[2];
            const sold_items = (sold_field.value === '```(empty)```' ? [] : sold_field.value.slice(4, -3).split('\n').map(i => parse_item(i)));
            let total = 0;
            sold_items.forEach(si => total += si.price * (si.quantity != null ? si.quantity : 1));

            embed.fields[3].value = `**${total.toLocaleString()}z**`;
        }

        function update_final_shares(embed) {
            const roster_size = embed.fields[0].value === '(empty)' ? 0 : embed.fields[0].value.split('\n').length;
            if (roster_size > 0) {
                const total_sold = embed.fields[3].value === '\u200B' ? 0 : parse_price(embed.fields[3].value);
                const bio_shares = embed.fields[4].value === '\u200B' ? 0 : parse_price(embed.fields[4].value);

                const shares = Math.floor((total_sold - bio_shares) / roster_size);
                const bio = (shares + bio_shares).toLocaleString();
                const others = shares.toLocaleString();

                const share_message = embed.fields[4].value === '\u200B' ?
`\`\`\`
${roster_size} players
- Everyone: ${others}z
\`\`\`` : `\`\`\`
${roster_size} players
- Bio:    ${bio}z
- Others: ${others}z
\`\`\`
`
                embed.fields[5].value = share_message;
            }
        }

        async function help(title, content) {
            await message.client.help(message, title, content);
        }

        if (args[0] === 'help') {
            const command = (args.length > 1) ? args[1] : null;
            if (command == null) {
                help(`${PREFIX}vend`,
`Keep track of items to vend.

Available \`${PREFIX}vend\` commands:
\`\`\`
- set-vending-channel
- set-sold-channel
- new
- set-current-vend
- set-roster
- set-bio-shares
- set-image
- add-items
- set-item-price
- set-item-quantity
- remove-item | delete-item
- set-items
- sold
- set-sold
- list
- end
\`\`\`
Type \`${PREFIX}vend help COMMAND\` with the command of your choice for more info.`
                );
            } else if (command === 'set-vending-channel') {
                help(`${PREFIX}vend set-vending-channel #channel`,
`Keeps track of active vends on the selected channel.

Example:
\`\`\`${PREFIX}vend set-vending-channel #vending\`\`\``
                );
            } else if (command === 'set-vending-channel') {
                help(`${PREFIX}vend set-sold-channel #channel`,
`Keeps track of sold vends on the selected channel.

Example:
\`\`\`${PREFIX}vend set-sold-channel #sold\`\`\``
                );
            } else if (command === 'new') {
               help(`${PREFIX}vend new _VEND NAME_`,
`Creates a new vend with name _VEND NAME_, and sets the current vend to that newly created one.
Vends can be viewed on the vending channel.

Example:
\`\`\`${PREFIX}vend new LK ET 2021-06-18\`\`\``
                );
            } else if (command === 'set-current-vend') {
               help(`${PREFIX}vend set-current-vend _VEND NAME_`,
`Sets the current vend. Name should be matching an existing vend.

Example:
\`\`\`${PREFIX}vend set-current-vend LK ET 2021-06-18\`\`\``
                );
            } else if (command === 'set-bio-shares') {
               help(`${PREFIX}vend set-bio-shares <price>`,
`Sets the extra zeny to cover bio expenses.
\`<price>\`: Can be in the following formats: 1.5m, 1500000z, 1,500,000z, 1m500k\`

Example:
\`\`\`${PREFIX}vend set-bio-shares 250k\`\`\``
                );
            } else if (command === 'set-image') {
               help(`${PREFIX}vend set-image <image_url>`,
`Sets an image to the current vend.
\`<image_url>\`: URL of the image to add to the current vend

Example:
\`\`\`${PREFIX}vend set-image <https://cdn.discordapp.com/attachments/711065960840429578/847788329394372608/0b4a0ddb19e3b24543eb757982d98e0c.png>\`\`\``
                );
            } else if (command === 'add-items') {
               help(`${PREFIX}vend add-items <MULTILINE LIST OF ITEMS>`,
`Add items to current vend.
Format of one item is the following: \`name [xQUANTITY] [PRICE]\`
\`name\`: Name of item
\`xQUANTITY\` _(Optional)_:  Amount of items. Example: x5
\`PRICE\` _(Optional)_: Unit price of item. PRICE can be in the following formats: 1.5m, 1500000z, 1,500,000z, 1m500k

Example:
\`\`\`${PREFIX}vend add-items
VS[1] 30m
Elu x12 5k
Rough oridecon x5
FA[1]\`\`\``
                );
            } else if (command === 'set-item-price') {
               help(`${PREFIX}vend set-item-price <name> <price>`,
`(Re)set the item price of the current vend.
\`<name>\`: Item name
\`<price>\`: Unit price of item. PRICE can be in the following formats: 1.5m, 1500000z, 1,500,000z, 1m500k

Example:
\`\`\`${PREFIX}vend set-item-price VS[[1] 35m\`\`\``
                );
            } else if (command === 'set-item-quantity') {
               help(`${PREFIX}vend set-item-quantity <name> <xQuantity>`,
`(Re)sets the item quantity for current vend.
\`<name>\`: Item name
\`<xQuantity>\`: Amount of items. Example: x5

Example:
\`\`\`${PREFIX}vend set-item-quantity Rough oridecon x3\`\`\``
                );
            } else if (command === 'remove-item' || command === 'delete-item') {
               help(`${PREFIX}vend remove-item <name>`,
`Completely remove the item entry from current vend.
\`<name>\`: Item name

Example:
\`\`\`${PREFIX}vend remove-item Rough oridecon\`\`\``
                );
            } else if (command === 'set-items') {
               help(`${PREFIX}vend set-items <MULTILINE LIST OF ITEMS>`,
`Replace the entire list of items of current vend.
\`<MULTILINE LIST OF ITEMS>\`: All items as per the format used in the _Items_ section.

Example:
\`\`\`${PREFIX}vend set-items
VS[1] 30m
Elu x12 5k
Rough oridecon x5
FA[1]\`\`\``
                );
            } else if (command === 'sold') {
               help(`${PREFIX}vend sold <name> [<xQuantity>] [<price>]`,
`Search through all active vends for item <name>, and marks it as "sold" for the given quantity and price.
\`xQuantity\` _(Optional)_: If not provided, only 1 item of <name> will be marked as sold.
\`price\` _(Optional)_: If provided, it will replace the initial price of the item.

If ALL items are marked as sold and roster is provided, **Shares** will be calculated.

Example:
\`\`\`${PREFIX}vend sold Elu x12 6k
${PREFIX}vend sold VS[1]
${PREFIX}vend sold Rough oridecon x3\`\`\``
                );
            } else if (command === 'set-sold') {
               help(`${PREFIX}vend sold <MULTILINE LIST OF ITEMS>`,
`(Re)sets the entire sold item section to the list of items of the current vend.
\`<MULTILINE LIST OF ITEMS>\`: All items as per the format used in the _Sold_ section.

Example:
\`\`\`${PREFIX}vend set-sold
VS[1]    30,000,000z
Elu           6,000z    x12\`\`\``
                );
            } else if (command === 'list') {
               help(`${PREFIX}vend list <items|sold> [<name>]`,
`Returns the list of items or sold items of the current vend.
For the lazy who don't want to check on the #vending channel 🙂
\`<items|sold>\`: \`items\` to check the item list, \`sold\` to check the sold list
\`<name>\` _(Optional)_: Vend name. If not provided, the current vend will be used.

Examples:
\`\`\`${PREFIX}vend list items
${PREFIX}vend list sold
${PREFIX}vend list items LK ET 2021-06-18\`\`\``
                );
            } else if (command === 'end') {
               help(`${PREFIX}vend end [<name>]`,
`If all items of selected vend are sold, then mark the entire vend as sold. Vend will be moved from the #vending channel to the #sold channel.
\`<name>\` _(Optional)_: Vend name. If not provided, the current vend will be used.

Examples:
\`\`\`${PREFIX}vend end
${PREFIX}vend end LK ET 2021-06-18\`\`\``
                );
            } else {
                message.channel.send(`❌ Unrecognized command. Check \`${PREFIX}vend help\` for available commands.`)
            }
        } else if (args[0] === 'set-vending-channel') {
            const channel_id = args[1].slice(2, -1);
            const channel = message.guild.channels.cache.get(channel_id);
            await cache.set(CHANNEL_VENDING, channel.id);
            message.channel.send(`✅ Successfully set ${CHANNEL_VENDING} channel to <#${channel.id}>`);
        } else if (args[0] === 'set-sold-channel') {
            const channel_id = args[1].slice(2, -1);
            const channel = message.guild.channels.cache.get(channel_id);
            await cache.set(CHANNEL_SOLD, channel.id);
            message.channel.send(`✅ Successfully set sold channel to <#${channel.id}>`);
        } else if (args[0] === 'new' && args.length > 1) {
            if (! await validate_channels())
                return;
            const vend_name = args[1];
            const channel = await get_channel(CHANNEL_VENDING);

            const channel_messages = await channel.messages.fetch()
            const vend_message = channel_messages.find(msg => msg.embeds[0].title.toLowerCase() === vend_name.toLowerCase());
            if (vend_message != undefined) {
                message.channel.send(`❌ Vend ${vend_name} already exists`);
                return;
            }

            const embed = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle(vend_name)
                .setAuthor('Vending', message.author.displayAvatarURL({format: 'jpg'}))
                .setDescription(`By <@${message.author.id}>`)
                .addFields(
                    { name: 'Roster', value: '(empty)' },
                    { name: 'Items', value: '```(empty)```' },
                    { name: 'Sold', value: '```(empty)```' },
                    { name: 'Total sold', value: '\u200B', inline: true },
                    { name: 'Bio shares', value: '\u200B', inline: true },
                    { name: 'Shares', value: '\u200B' },
                )
                .setTimestamp();

            await cache.set(CURRENT_VENDING, vend_name);
            channel.send(embed);
            message.channel.send(`✅ New vend **${vend_name}** created in <#${channel.id}>`);
            message.channel.send(`✅ Current vend set to **${vend_name}**`);
        } else if (args[0] === 'set-current-vend') {
            if (! await validate_channels())
                return;
            const vend_name = args[1];
            const vend_message = await get_vend_message(message.author, vend_name);
            if (vend_message == null)
                return;

            await cache.set(CURRENT_VENDING, vend_name);
            message.channel.send(`✅ Current vend set to **${vend_name}**`);
        } else if (args[0] === 'current') {
            if (! await validate_channels())
                return;

            const vend_name = await cache.get(CURRENT_VENDING);
            message.channel.send(`💡 Current vend: **${vend_name}**`);
        } else if (args[0] === 'set-roster') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const full_roster = args[1];

            const embed = vend_message.embeds[0];
            embed.fields[0].value = full_roster;
            const current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const sold_items = (embed.fields[2].value === '```(empty)```' ? [] : embed.fields[2].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            if (current_items.length === 0 && sold_items.length > 0) {
                update_final_shares(embed);
            }

            vend_message.edit(embed);
            message.channel.send(`✅ **${embed.title}**: Roster updated!`);
        } else if (args[0] === 'list') {
            if (! await validate_channels() || ! await validate_current())
                return;

            const spaceIdx = args[1].indexOf(" ");
            const extraArgs = spaceIdx < 0 ? [args[1]] : [args[1].slice(0, spaceIdx), args[1].slice(spaceIdx + 1)];

            let field_idx = null;
            if (extraArgs[0] === "items") {
                field_idx = 1;
            } else if (extraArgs[0] === "sold") {
                field_idx = 2;
            } else {
                message.channel.send(`❌ Usage: _${PREFIX}vend list items [vend\\_name]_ or _${PREFIX}vend list sold [vend\\_name]_`);
                return;
            }
            const vend_name = extraArgs.length > 1 ? extraArgs[1] : null;
            const vend_message = await get_vend_message(message.author, vend_name);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            message.channel.send(embed.fields[field_idx].value);
        } else if (args[0] === 'set-bio-shares') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            const current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const sold_items = (embed.fields[2].value === '```(empty)```' ? [] : embed.fields[2].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const shares = parse_price(args[1]);

            embed.fields[4].value = `**${shares.toLocaleString()}z**`;
            if (current_items.length === 0 && sold_items.length > 0) {
                update_final_shares(embed);
            }
            vend_message.edit(embed);
            message.channel.send(`✅ **${embed.title}**: Bio shares updated!`);
        } else if (args[0] === 'set-image') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            const url = (args[1].startsWith('<') && args[1].endsWith('>')) ? args[1].slice(1, -1) : args[1];
            embed.setImage(url);
            vend_message.edit(embed);
            message.channel.send(`✅ **${embed.title}**: Image updated!`);
        } else if (args[0] === 'set-items') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            const items_string = args[1];
            const items = items_string.split('\n').map(i => parse_item(i));
            const formatted_items = format_items(items);

            if (formatted_items.length > 0) {
                embed.fields[1].value = "```\n" + formatted_items.join('\n') + "```";
                vend_message.edit(embed);
                message.channel.send(`✅ **${embed.title}**: Items set!`);
            } else {
                message.channel.send(`❌ **${embed.title}**: Nothing has been added!`);
            }
        } else if (args[0] === 'add-item' || args[0] === 'add-items') {
            if (! await validate_channels() || ! await validate_current())
                return;

            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            const current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const items_string = args[1];
            const items = items_string.split('\n').map(i => parse_item(i));

            const duplicate = items.find(i => current_items.find(f => f.name.toLowerCase() === i.name.toLowerCase()));
            if (duplicate != undefined) {
                message.channel.send(`❌ **${embed.title}**: Item ${duplicate.name} already exists!`);
                return;
            }

            const all_items = current_items.concat(items);
            const formatted_items = format_items(all_items);

            if (formatted_items.length > 0) {
                embed.fields[1].value = "```\n" + formatted_items.join('\n') + "```";
                vend_message.edit(embed);
                message.channel.send(`✅ **${embed.title}**: Items added!`);
            } else {
                message.channel.send(`❌ **${embed.title}**: Nothing has been added!`);
            }
        } else if (args[0] === 'set-item-price') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            const current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const item = parse_item(args[1]);

            const item_to_update = current_items.find(f => f.name.toLowerCase() === item.name.toLowerCase());
            if (item_to_update === undefined) {
                message.channel.send(`❌ **${embed.title}**: Item ${item.name} not found!`);
                return;
            }
            item_to_update.price = item.price;

            const formatted_items = format_items(current_items);
            embed.fields[1].value = "```\n" + formatted_items.join('\n') + "```";
            vend_message.edit(embed);
            message.channel.send(`✅ **${embed.title}**: Item ${item.name} price updated to ${item.price.toLocaleString()}z!`);
        } else if (args[0] === 'set-item-quantity') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            const current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const item = parse_item(args[1]);

            const item_to_update = current_items.find(f => f.name.toLowerCase() === item.name.toLowerCase());
            if (item_to_update === undefined) {
                message.channel.send(`❌ **${embed.title}**: Item ${item.name} not found!`);
                return;
            }
            item_to_update.quantity = item.quantity;

            const formatted_items = format_items(current_items);
            embed.fields[1].value = "```\n" + formatted_items.join('\n') + "```";
            vend_message.edit(embed);
            message.channel.send(`✅ **${embed.title}**: Item ${item.name} quantity updated to ${item.quantity}!`);
        } else if (args[0] === 'remove-item' || args[0] === 'delete-item') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            let current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            const item = parse_item(args[1]);

            const item_idx_to_delete = current_items.findIndex(f => f.name.toLowerCase() === item.name.toLowerCase());
            if (item_idx_to_delete < 0) {
                message.channel.send(`❌ **${embed.title}**: Item ${item.name} not found!`);
                return;
            }
            current_items.splice(item_idx_to_delete, 1);

            if (current_items.length === 0) {
                embed.fields[1].value = "```(empty)```";
            } else {
                const formatted_items = format_items(current_items);
                embed.fields[1].value = "```\n" + formatted_items.join('\n') + "```";
            }

            vend_message.edit(embed);
            message.channel.send(`✅ **${embed.title}**: Item ${item.name} removed!`);
        } else if (args[0] === 'set-sold') {
            if (! await validate_channels() || ! await validate_current())
                return;
            const vend_message = await get_vend_message(message.author);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            const items_string = args[1];
            if (items_string === '(empty)') {
                embed.fields[2].value = "```(empty)```";
                embed.fields[3].value = '\u200B';
                vend_message.edit(embed);
                message.channel.send(`✅ **${embed.title}**: Sold items cleared!`);
            } else {
                const items = items_string.split('\n').map(i => parse_item(i));
                const formatted_items = format_items(items);

                if (formatted_items.length > 0) {
                    embed.fields[2].value = "```\n" + formatted_items.join('\n') + "```";
                    update_total_sold(embed);
                    vend_message.edit(embed);
                    message.channel.send(`✅ **${embed.title}**: Sold items set!`);
                } else {
                    message.channel.send(`❌ ${embed.title}: Nothing has been set!`);
                }
            }
        } else if (args[0] === 'sold') {
            if (! await validate_channels())
                return;
            const item = parse_item(args[1]);
            const messages_with_item = await get_vend_messages_by_item(message.author, item.name);

            async function confirm_and_sold(msg_idx = 0, skip_confirm = false) {
                const message_with_item = messages_with_item[msg_idx];
                const embed = message_with_item.embeds[0];
                const vend_name = embed.title;
                let message_items = embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i));
                const message_item_idx = message_items.findIndex(mi => mi.name.toLowerCase() === item.name.toLowerCase());
                const message_item = message_items[message_item_idx];
                const price = item.price != null ? item.price : message_item.price;
                const quantity = item.quantity != null ? item.quantity : 1;
                const message_item_quantity = message_item.quantity != null ? message_item.quantity : 1;

                function sold_item() {
                    const remaining_quantity = message_item_quantity - quantity;

                    const message_sold_items = (embed.fields[2].value === '```(empty)```' ? [] : embed.fields[2].value.slice(4, -3).split('\n').map(i => parse_item(i)));
                    const sold_item = { name: item.name, quantity: item.quantity, price: price }
                    message_sold_items.push(sold_item);
                    const formatted_sold_items = format_items(message_sold_items);
                    embed.fields[2].value = "```\n" + formatted_sold_items.join('\n') + "```";

                    if (remaining_quantity > 0) {
                        message_item.quantity = remaining_quantity;
                    } else {
                        message_items.splice(message_item_idx, 1);
                    }

                    update_total_sold(embed);
                    if (message_items.length === 0) {
                        embed.fields[1].value = "```(empty)```";
                        update_final_shares(embed);
                    } else {
                        const formatted_items = format_items(message_items);
                        embed.fields[1].value = "```\n" + formatted_items.join('\n') + "```";
                    }

                    message_with_item.edit(embed);
                    message.channel.send(`✅ **${vend_name}**: **${item.name}** (_x${quantity}_) has been sold for **${price.toLocaleString()}z**`);
                }

                if (price === null) {
                    message.channel.send('❌ A price must be set either in !sold command, or in vend item!');
                } else if (quantity > message_item_quantity) {
                    message.channel.send(`❌ There's only ${message_item_quantity} of ${item.name} available in ${vend_name}`);
                } else if (skip_confirm) {
                    sold_item();
                } else {
                    const confirm_filter = (reaction, user) => { return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id; };
                    const confirm_message = await message.channel.send(`:grey_question: **${vend_name}**: Mark **${item.name}** (_x${quantity}_) as sold for **${price.toLocaleString()}z**?`);
                    confirm_message.react('✅').then(() => confirm_message.react('❌'));
                    confirm_message
                        .awaitReactions(confirm_filter, { max: 1, time: 60000, errors: ['time'] })
                        .then(collected => {
                            const reaction = collected.first();

                            if (reaction.emoji.name !== '✅') {
                                message.channel.send('❌ User cancelled');
                            } else {
                                // Sold item here!!
                                sold_item();
                            }
                            confirm_message.delete();
                        })
                        .catch(collected => {
                            logger.error(collected);
                            message.channel.send("❌ Action cancelled");
                            confirm_message.delete();
                        });
                }
            }

            if (messages_with_item.length > 1) {
                const vend_names = messages_with_item.map(m => m.embeds[0].title);
                const question =
`⚠️ Please choose for which vend this applies:

${vend_names.map((elt, idx) => `\`${idx + 1}.\` ${elt}`).join('\n')}
`;
                const questionEmbed = new Discord.MessageEmbed().setDescription(question);
                const filter = m => m.author === message.author;
                message.channel.send(questionEmbed).then(() => {
                    message.channel.awaitMessages(filter, { max: 1 })
                        .then(async collected => {
                            const reply = collected.first().content;
                            const choice = parseInt(reply);
                            if (choice === NaN || choice > messages_with_item.length) {
                                message.channel.send('❌ Invalid choice!');
                            } else {
                                await confirm_and_sold(choice - 1);
                            }
                        })
                        .catch(collected => {
                            logger.error(collected);
                            message.channel.send('❌ Action cancelled');
                        });
                });
            } else if (messages_with_item.length == 1) {
                await confirm_and_sold(0, true);
            } else {
                message.channel.send(`❌ Couldn't find any of ${message.author.username}'s vend with **${item.name}**`);
            }
        } else if (args[0] === 'end') {
            if (! await validate_channels() || ! await validate_current())
                return;

            let vend_name = (args.length > 1) ? args[1] : null;
            const vend_message = await get_vend_message(message.author, vend_name);
            if (vend_message == null)
                return;

            const embed = vend_message.embeds[0];
            vend_name = embed.title;

            const current_items = (embed.fields[1].value === '```(empty)```' ? [] : embed.fields[1].value.slice(4, -3).split('\n').map(i => parse_item(i)));
            if (current_items.length > 0) {
                message.channel.send(`❌ **${vend_name}**: Some items haven't been sold yet!`);
                return;
            }

            const confirm_filter = (reaction, user) => { return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id; };
            const confirm_message = await message.channel.send(`:grey_question: Mark **${vend_name}** as finished?`);
            confirm_message.react('✅').then(() => confirm_message.react('❌'));
            confirm_message
                .awaitReactions(confirm_filter, { max: 1, time: 60000, errors: ['time'] })
                .then(async collected => {
                    const reaction = collected.first();

                    if (reaction.emoji.name !== '✅') {
                        message.channel.send('❌ User cancelled');
                        confirm_message.delete();
                    } else {
                        const channel_sold = await get_channel(CHANNEL_SOLD);
                        embed
                            .setColor("#009900")
                            .setTimestamp();

                        channel_sold.send(embed);

                        vend_message.delete();
                        message.channel.send(`✅ **${vend_name}** completed!`);
                        confirm_message.delete();
                    }
                })
                .catch(collected => {
                    logger.error(collected);
                    message.channel.send("❌ Action cancelled");
                    confirm_message.delete();
                });
        }
    },
};