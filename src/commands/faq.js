const { SlashCommandBuilder, ContainerBuilder, MessageFlags} = require('discord.js')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('faq').setDescription('USF Bot Frequently Asked Questions')
        .setDMPermission(true),
    async execute(interaction) {
        await interaction.deferReply()
        const faqs = new ContainerBuilder()
            .setAccentColor(0x0000ff)
            .addTextDisplayComponents(component => component.setContent('# USF Bot FAQs\n\n- How to get a list of links & commands?\nRun </help:1146879134824411206> for further info\n\n- How to get a brief description of the bot?\nRun </info:1114970638969475083> for further info'));
        return interaction.editReply({ components: [faqs], flags: MessageFlags.IsComponentsV2 })
    }
}