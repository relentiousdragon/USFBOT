const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

const purgeQueue = [];
let isRunning = false;
//
async function bulkDeleteMessages(channel, amount, targetUserIds = null, beforeMessageId = null) {
    let deletedCount = 0;
    let remaining = amount;

    while (remaining > 0) {
        let fetchLimit = Math.min(remaining, 100);
        let fetchOptions = { limit: fetchLimit };
        if (beforeMessageId) fetchOptions.before = beforeMessageId;

        let fetched = await channel.messages.fetch(fetchOptions).catch(() => null);
        if (!fetched || fetched.size === 0) break;

        let deletable = fetched.filter(msg => (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);
        if (targetUserIds) deletable = deletable.filter(msg => targetUserIds.includes(msg.author.id));
        if (deletable.size === 0) break;

        beforeMessageId = deletable.last()?.id;

        if (deletable.size > 1) {
            await channel.bulkDelete(deletable, true).catch(() => {});
        } else {
            for (const msg of deletable.values()) await msg.delete().catch(() => {});
        }

        deletedCount += deletable.size;
        remaining -= deletable.size;
        if (remaining <= 0) break;
        await new Promise(res => setTimeout(res, 1000));
    }

    return deletedCount;
}

async function processQueue(client) {
    if (isRunning || purgeQueue.length === 0) return;
    isRunning = true;

    const job = purgeQueue.shift();
    const { channelId, amount, userIds, interaction, beforeMessageId } = job;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        await interaction?.reply({ content: '❌ Could not fetch the channel.', flags: MessageFlags.Ephemeral }).catch(() => {});
        isRunning = false;
        processQueue(client);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Purge Started')
        .setDescription(`Deleting up to **${amount} messages**${userIds ? ' from specified user' : ''}...`)
        .setColor(0x5865F2);

    await interaction?.reply({ embeds: [embed] }).catch(() => {});

    try {
        const deleted = await bulkDeleteMessages(channel, amount, userIds, beforeMessageId);
        const resultEmbed = new EmbedBuilder()
            .setTitle('✅ Purge Completed')
            .setDescription(`Deleted **${deleted} messages** successfully.`)
            .setColor(0x18B035);
        await interaction?.editReply({ embeds: [resultEmbed] }).catch(() => {});
    } catch (err) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Purge Failed')
            .setDescription(`Error: \`${err.message}\``)
            .setColor(0xFF0000);
        await interaction?.editReply({ embeds: [errorEmbed] }).catch(() => {});
    }

    isRunning = false;
    processQueue(client);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete messages in bulk')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages | PermissionsBitField.Flags.Administrator)
        .setDMPermission(false)
        .addIntegerOption(opt =>
            opt.setName('amount')
               .setDescription('Number of messages to delete')
               .setRequired(true)
        )
        .addUserOption(opt =>
            opt.setName('user')
               .setDescription('Delete messages from specific user (optional)')
        ),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) &&
            !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const amount = interaction.options.getInteger('amount');
        if (!amount || amount <= 0 || amount > 2_000) {
            return interaction.reply({ content: '❌ Please specify a valid number of messages (1 - 2,000).', flags: MessageFlags.Ephemeral });
        }

        const user = interaction.options.getUser('user');
        const userIds = user ? [user.id] : null;
        const beforeMessageId = interaction.id;

        if (purgeQueue.some(job => job.channelId === interaction.channelId) || isRunning) {
            purgeQueue.push({ channelId: interaction.channelId, amount, userIds, interaction, beforeMessageId });
            return interaction.reply({ content: '⚠️ A purge is already queued for this channel. Your request has been added to the queue.' });
        }

        purgeQueue.push({ channelId: interaction.channelId, amount, userIds, interaction, beforeMessageId });
        processQueue(interaction.client);
    },
    bulkDeleteMessages
};
