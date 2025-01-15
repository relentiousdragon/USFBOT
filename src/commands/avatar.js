const { SlashCommandBuilder } = require('discord.js')
const { avatar } = require('../embeds/avatarEmbeds.js')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar').setDescription('Get the avatar of a selected user or your own avatar')
        .addUserOption(option=>option.setName('user').setDescription("the user's avatar to show").setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('user') ?? interaction.user
        avatar.setTitle(`${user.username}\'s avatar`).setImage(`${user.displayAvatarURL({ size: 4096 })}`).setTimestamp();
        return interaction.editReply({ embeds: [avatar] });
    }
}