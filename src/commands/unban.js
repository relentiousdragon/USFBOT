const { PermissionsBitField, SlashCommandBuilder, MessageFlags } = require('discord.js');
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban').setDescription('Unban an user from the server')
        .addUserOption(option=>option.setName('target').setDescription('Target user of the moderation').setRequired(true))
        .addStringOption(option=>option.setName('reason').setDescription('Reason of the moderation'))
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral})
        if (interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            const member = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') ?? `${interaction.user.username} : No reason provided`;
            interaction.guild.bans.fetch(`${member.id}`)
                .then(async int => {
                    interaction.guild.members.unban(`${member.id}`, `${reason}`)
                    return interaction.editReply({content: 'User successfully unbanned', flags: MessageFlags.Ephemeral})
                })
                .catch(error => {
                    console.error
                    return interaction.editReply({content: 'The selected user is not banned', flags: MessageFlags.Ephemeral})
                });
        } else {
            return interaction.editReply({content: 'You are not permitted to perform this action', flags: MessageFlags.Ephemeral})
        }
    }
}