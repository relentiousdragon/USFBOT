const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { addReminder, listReminders, deleteReminder } = require('../utils/reminderManager.js');
const { filterQuery } = require('./search.js');
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Manage reminders')
    .setDMPermission(true)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Create a new reminder')
        .addStringOption(opt => opt.setName('time').setDescription('When (e.g. 10m, 2h, 3d)').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Reminder text').setRequired(true).setMaxLength(500))
        .addBooleanOption(opt => opt.setName('dm').setDescription('Send as DM instead of channel'))
        .addStringOption(opt => opt.setName('repeat').setDescription('Recurring interval (e.g. 1d, 2h, 0 for none)'))
        .addIntegerOption(opt => opt.setName('times').setDescription('How many times (blank = forever)'))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List your reminders'))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a reminder')
        .addStringOption(opt => opt.setName('id').setDescription('Reminder ID').setRequired(true).setAutocomplete(true))
    ),

  async execute(interaction) {
    const botAvatar = interaction.client.user.displayAvatarURL();
    const sub = interaction.options.getSubcommand();
    const isDM = interaction.options.getBoolean('dm') ?? interaction.channel?.isDMBased();

    const addFooter = embed => embed.setFooter({ text: 'USF Bot', iconURL: botAvatar });

    if (sub === 'add') {
      const userReminders = await listReminders(interaction.user.id);
      if (userReminders.length >= 5) {
        return interaction.reply({
          embeds: [addFooter(new EmbedBuilder()
            .setTitle('❌ Maximum Reminders Reached')
            .setDescription('You can only have **5 active reminders** at a time.')
            .setColor(0xFF0000))],
          flags: MessageFlags.Ephemeral
        });
      }

const ms = parseTime(interaction.options.getString('time'));
if (!ms || ms < 30 * 1000 || ms > 1000 * 60 * 60 * 24 * 30) {
  return interaction.reply({
    embeds: [addFooter(new EmbedBuilder()
      .setTitle('❌ Invalid Time')
      .setDescription('Time must be between 30 seconds and 30 days.')
      .setColor(0xFF0000))],
    flags: MessageFlags.Ephemeral
  });
}

      const repeatStr = interaction.options.getString('repeat');
      let intervalMs = null;
      if (repeatStr && repeatStr !== '0') {
        if (!isDM) {
          return interaction.reply({
            embeds: [addFooter(new EmbedBuilder()
              .setTitle('❌ Recurring Not Allowed')
              .setDescription('Recurring reminders are **only allowed in DMs**.')
              .setColor(0xFF0000))],
            flags: MessageFlags.Ephemeral
          });
        }
        intervalMs = parseTime(repeatStr);
        if (!intervalMs || intervalMs < 1000 * 60 * 60 || intervalMs > 1000 * 60 * 60 * 24 * 30) {
          return interaction.reply({
            embeds: [addFooter(new EmbedBuilder()
              .setTitle('❌ Invalid Repeat Interval')
              .setDescription('Recurring interval must be **at least 1 hour** and up to 30 days.')
              .setColor(0xFF0000))],
            flags: MessageFlags.Ephemeral
          });
        }

        if (ms < 1000 * 60) {
          return interaction.reply({
            embeds: [addFooter(new EmbedBuilder()
              .setTitle('❌ Initial Reminder Too Soon')
              .setDescription('First reminder for recurring reminders must be at least **1 minute** from now.')
              .setColor(0xFF0000))],
            flags: MessageFlags.Ephemeral
          });
        }
      }

      let message = interaction.options.getString('message');
      if (!isDM) message = await filterQuery(message);

      const reminderData = {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        dm: isDM,
        message,
        dueTime: Date.now() + ms,
        recurring: intervalMs ? { intervalMs, times: interaction.options.getInteger('times') } : null
      };

      const reminder = await addReminder(reminderData);

      const firstTimeout = reminder.dueTime - Date.now();
      if (firstTimeout > 0) {
        setTimeout(async () => {
          try {
            await (isDM
              ? interaction.user.send(`⏰ Reminder: ${message}`)
              : interaction.channel.send(`<@${interaction.user.id}> ⏰ Reminder: ${message}`));

            if (reminder.recurring) {
              reminder.dueTime = Date.now() + reminder.recurring.intervalMs;
            } else {
              await deleteReminder(interaction.user.id, reminder.id);
            }
          } catch (e) {
            console.error('Failed to send reminder:', e);
          }
        }, firstTimeout);
      }

      const embed = addFooter(new EmbedBuilder()
        .setTitle('✅ Reminder Created')
        .addFields(
          { name: 'Message', value: message },
          { name: 'Due', value: `<t:${Math.floor(reminder.dueTime / 1000)}:R>` },
          { name: 'Recurring', value: reminder.recurring ? `Every ${repeatStr}` : 'No' }
        )
        .setColor(0x18B035));

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      let list = await listReminders(interaction.user.id);
      if (!list.length) return interaction.reply({ content: 'You have no reminders.', flags: MessageFlags.Ephemeral });

      list = await Promise.all(list.map(async r => {
        if (!r.dm) r.message = await filterQuery(r.message);
        return r;
      }));

      const embed = addFooter(new EmbedBuilder()
        .setTitle('📝 Your Active Reminders')
        .setColor(0x00FFFF)
        .setDescription(list.map(r =>
          `**ID:** \`${r.id}\`\n⏰ <t:${Math.floor(r.dueTime / 1000)}:R>\n📝 ${r.message}` +
          (r.recurring ? `\n🔁 Recurs again <t:${Math.floor((r.dueTime + r.recurring.intervalMs)/1000)}:R>` : '')
        ).join('\n\n')));

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'delete') {
      const ok = await deleteReminder(interaction.user.id, interaction.options.getString('id'));
      const embed = addFooter(new EmbedBuilder()
        .setTitle(ok ? '✅ Reminder Deleted' : '❌ Reminder Not Found')
        .setColor(ok ? 0x18B035 : 0xFF0000));
      return interaction.reply({ embeds: [embed] });
    }
  }
};

function parseTime(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const n = parseInt(match[1]);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return n * mult;
}
