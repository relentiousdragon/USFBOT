const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('channel').setDescription('Get information about a channel')
        .addChannelOption(option => option.setName('channel').setDescription('The channel to get information about').setRequired(true))
        .setDMPermission(false),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        if (!channel || channel.guild.id !== interaction.guild.id) {
            return interaction.reply('Please provide a valid channel in this server!');
        }
        let channelType;
        switch (channel.type) {
            case 0: channelType = 'Guild Text Channel'; break;
            case 2: channelType = 'Guild Voice Channel'; break;
            case 4: channelType = 'Guild Category'; break;
            case 5: channelType = 'Guild Announcements Channel'; break;
            case 13: channelType = 'Guild Conferences Channel'; break;
            case 15: channelType = 'Guild Forum Channel'; break;
            case 16: channelType = 'Guild Media Channel'; break;
            default: channelType = 'Non registred Channel Type!'; break;
        }
        const embed = new EmbedBuilder()
            .setColor(0x00ffff)
            .setTitle('Channel Information')
            .setDescription(`**Channel Name & ID:** ${channel.name} | ${channel.id}`)
            .addFields(
                { name: 'Created Date', value: `<t:${Math.round(channel.createdTimestamp/1000)}:F>`, inline: true },
                { name: 'Channel Type', value: `${channelType}`, inline: true },
            )
            .setTimestamp();
            if (!(channel.type == 4)) {
                if (channel.permissionsLocked === true) {
                    embed.addFields({ name: 'Category Permissions', value: 'Matches category', inline: true });
                } else if (channel.permissionsLocked === false) {
                    embed.addFields({ name: 'Category Permissions', value: 'Does not match category', inline: true });
                } else {
                    embed.addFields({ name: 'Category Permissions', value: 'Has no category', inline: true });
                }
            }
        console.log(channel);
        await interaction.reply({ embeds: [embed] });
    }
}