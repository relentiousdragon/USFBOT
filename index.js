const fs = require('node:fs')
const path = require('node:path')
const { ActivityType, Client, Collection, EmbedBuilder, Events, GatewayIntentBits, MessageFlags } = require('discord.js')
const { token, bannedGuilds, bannedUsers, joinlog, leavelog } = require('./config.json')
const client = new Client({ 
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.DirectMessages ], 
    presence: {
        status: 'ONLINE', 
        activities: [{ type: ActivityType.Playing, name: '/info'} 

    ]} 
});
const { start: startReminders, listReminders, deleteReminder } = require('./src/utils/reminderManager.js');
const { handlePagination } = require('./src/commands/search.js');
client.cooldowns = new Collection();
client.commands = new Collection();
//
const foldersPath = path.join(__dirname, 'src');
const commandFolders = fs.readdirSync(foldersPath);
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		}
	}
}
//
client.once(Events.ClientReady, () => {
    console.log(`Client Logged in as ${client.user.tag}!\nServices working as expected\n\n`);
    startReminders(client);
})
//
client.on(Events.InteractionCreate, async interaction => {
    // DEBUG STUFF //
    /* console.log(`[DEBUG] Interaction received:`, {
        commandName: interaction.commandName,
        options: interaction.options?._hoistedOptions,
        isChatInputCommand: interaction.isChatInputCommand(),
        isButton: interaction.isButton(),
        isAutocomplete: interaction.isAutocomplete(),
        isModalSubmit: interaction.isModalSubmit()
    });  */
    if (bannedUsers.includes(interaction.user.id)) {
        return;
    }
    if (interaction.guild) {
        if (bannedGuilds.includes(interaction.guild.id)) {
            return;
        }
    }
    if (interaction.isAutocomplete()) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'id') {
    const reminders = await listReminders(interaction.user.id);
    const choices = reminders.map(r => ({
      name: r.message.length > 30 ? r.message.slice(0, 30) + '...' : r.message,
      value: r.id
    }));

    await interaction.respond(choices.slice(0, 25));
  }
  return;
}
        if (interaction.isButton()) {
        if (interaction.customId.startsWith('search_')) {
          await handlePagination(interaction);
        }
        if (interaction.customId.startsWith('deleteReminder_')) {
            const reminders = await listReminders(interaction.user.id);
      const reminderId = interaction.customId.split('_')[1];
      const reminder = reminders.find(r => r.id === reminderId);

      if (!reminder) {
        return interaction.reply({ content: 'This reminder no longer exists.', ephemeral: true });
      }

      if (interaction.user.id !== reminder.userId) {
        return interaction.reply({ content: 'Only the reminder owner can delete this.', ephemeral: true });
      }

      await deleteReminder(reminder.userId, reminder.id);
      await interaction.update({ content: 'Reminder deleted ✅', embeds: [], components: [] });
    }
        if (interaction.customId.startsWith('dictionary_pronounce_')) {
          const dictionary = require('./src/commands/dictionary.js');
          await dictionary.handlePronunciationButton(interaction);
          return;
        }
        if (interaction.customId.startsWith('meme_refresh_')) {
            const meme = require('./src/commands/meme.js');
            await meme.handleButton(interaction);
            return;
        }
    }
    if (!interaction.isChatInputCommand()) return;
    let command = client.commands.get(interaction.commandName);
    if (command && interaction.options.getSubcommand(false)) {
        const sub = interaction.options.getSubcommand(false);
        if (command[sub] && typeof command[sub].execute === 'function') {
            command = command[sub];
        } else if (command[sub] && typeof command[sub] === 'object') {
            const subsub = interaction.options.getSubcommandGroup(false);
            if (subsub && command[sub][subsub] && typeof command[sub][subsub].execute === 'function') {
                command = command[sub][subsub];
            }
        }
    }
    if (!command || typeof command.execute !== 'function') {
        console.log(`No valid command handler found for:`, interaction.commandName);
        return;
    }

    const { cooldowns } = client;
    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Collection());
    }
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const defaultCooldownDuration = 3;
    const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;
    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1000);
            interaction.reply({ content: `Please wait <t:${expiredTimestamp}:R> more second(s)`, flags: MessageFlags.Ephemeral });
            return;
        }
    }
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] Command execution failed:`, error);
        const { erbed } = require('./src/embeds/index-embeds.js')
        erbed.setFooter({text: `${error}`})
        if (interaction.replied) {
            interaction.editReply({ embeds: [erbed], flags: MessageFlags.Ephemeral })
        } else {
            interaction.reply({ embeds: [erbed], flags: MessageFlags.Ephemeral })
        }
    }
})
//
client.on(Events.GuildCreate, guild => {
    const joinch = client.channels.cache.get(joinlog)
    const { joinEmbed } = require('./src/embeds/index-embeds.js')
    	joinEmbed.setFields(
      		{ name: 'Server name', value: `${guild.name}` },
      		{ name: '\u200B', value: '\u200B' },
      		{ name: 'Members', value: `${guild.memberCount}`, inline: true },
      		{ name: 'ID', value: `${guild.id}`, inline: true },
      		{ name: 'GuildsCount', value: `${client.guilds.cache.size}`, inline: true },
    	).setTimestamp();
    if (guild.icon) {
        joinEmbed.setThumbnail(`${guild.iconURL({ size: 2048 }) }`);
    }
    joinch.send({embeds:[joinEmbed]});
    if (bannedGuilds.includes(guild.id)) {
        guild.leave()
        joinch.send('This Guild is blacklisted. The Bot left the guild.')
    }
});
client.on(Events.GuildDelete, async guild => {
    if (client.isReady()) {
        const leavech = await client.channels.fetch(leavelog);
        const { leaveEmbed } = require('./src/embeds/index-embeds.js')
        leaveEmbed.setFields(
                { name: 'Server Name', value: `${guild.name}`},
                { name: '\u200B', value: '\u200B' },
                { name: 'Members', value: `${guild.memberCount}`, inline: true },
                { name: 'ID', value: `${guild.id}`, inline: true },
                { name: 'GuildsCount', value: `${client.guilds.cache.size}`, inline: true },
    	    ).setTimestamp();
        if (guild.icon) {
            leaveEmbed.setThumbnail(`${guild.iconURL({ size: 2048 }) }`)
        }
        leavech.send({ embeds: [leaveEmbed] })
    }
});

process.on('unhandledRejection', console.error)
process.on('uncaughtException', console.error)
client.login(token)