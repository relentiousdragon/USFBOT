const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute').setDescription('Unmute a Member')
        .addUserOption(option=>option.setName('target').setDescription('Member to unmute').setRequired(true))
        .addStringOption(option=>option.setName('reason').setDescription('Unmute reason').setMaxLength(200))
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        const member = interaction.options.getMember('target')
        const target = await interaction.guild.members.fetch(member.user.id)
        const reason = interaction.options.getString('reason') ?? 'No Reason Provided'
        if (!(interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))) {
            return interaction.editReply({ content: 'You do not have the required permission to execute this action : `ModerateMembers`', flags: MessageFlags.Ephemeral })
        }
        if (interaction.user.id === target.user.id) {
            return interaction.editReply({ content: 'You cannot unmute yourself!', flags: MessageFlags.Ephemeral })
        }
        if (!(target.moderatable)) {
            return interaction.editReply({ content: 'The bot is not allowed to perform this action!', flags: MessageFlags.Ephemeral })
        }
        if (target.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'You are not allowed to unmute this member!', flags: MessageFlags.Ephemeral })
        }
        try {
            target.disableCommunicationUntil(null, `[${interaction.user.username}] : ${reason}`)
            return interaction.editReply({ content: 'Action Executed Successfully', flags: MessageFlags.Ephemeral })
        } catch (error) {
            console.error(error)
            const { erbed } = require('../embeds/embeds.js')
            erbed.setFooter({ text: `${error}`})
            return interaction.editReply({ embeds: [erbed] })
        }
    }
}