const { SlashCommandBuilder } = require('discord.js')
const { version } = require('../../config.json')
const { infoEmbed } = require('../embeds/index-embeds.js')
const { infoRow } = require('../rows/infoRows.js')
var ms = require('ms')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('info').setDescription('Get information about the bot'),
    async execute(interaction) {
        await interaction.deferReply()
        let uptime = ms(interaction.client.uptime)
        infoEmbed.setFields(
            { name: 'Version', value: `${version}`, inline: true },
            { name: 'Guilds', value: `${interaction.client.guilds.cache.size}`, inline: true },
            { name: '\u200B', value: '\u200B' },
            { name: 'Total Members', value: `${interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`, inline: true },
            { name: 'Client Uptime', value: `${uptime}`, inline: true }
        ).setFooter({ text: `USF Bot`, iconURL: `${interaction.client.user.displayAvatarURL({size:32})}`}).setTimestamp();
        interaction.editReply({ components: [infoRow], embeds: [infoEmbed] });
    }
}