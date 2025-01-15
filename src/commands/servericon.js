const { SlashCommandBuilder } = require('discord.js')
const { servericon } = require('../embeds/serverEmbed.js')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('servericon').setDescription('Display the icon of this server'),
    async execute(interaction) {
        await interaction.deferReply()
        const guild = interaction.guild;
        if (!guild.icon) {
            return interaction.editReply('This server has no set icon!')
        } else {
            servericon.setImage(`${guild.iconURL({ size: 4096 })}`)
            interaction.editReply({ embeds: [servericon] })
        }
    }
}