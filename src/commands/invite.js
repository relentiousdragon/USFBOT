const { ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SlashCommandBuilder } = require('discord.js')
const { botinvite } = require('../../config.json')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite').setDescription('Invite the Bot to your servers!').setDMPermission(true),
    async execute(interaction) {
        await interaction.deferReply()
        const invitebutton = new ButtonBuilder()
            .setLabel('Invite')
            .setStyle(ButtonStyle.Link)
            .setURL(`${botinvite}`)
            .setEmoji('🔗');
            const invite = new ContainerBuilder()
                .setAccentColor(0x0000ff)
                .addTextDisplayComponents(component => component.setContent('## Invite the USF Bot!\nInvite the USF Bot to your servers or use it as user-installed app!\nClick the link button below to proceed!'))
                .addActionRowComponents(component => component.setComponents(invitebutton))
        return interaction.editReply({ components: [invite], flags: MessageFlags.IsComponentsV2 })
    }
}