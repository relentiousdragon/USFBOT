const { TextInputBuilder, TextInputStyle } = require('discord.js')
//
module.exports = {
    title: new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Announcement Title')
        .setMaxLength(100)
        .setPlaceholder('Uses markdown, header h1')
        .setRequired(false)
        .setStyle(TextInputStyle.Short),
    description: new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Announcement Description')
        .setMaxLength(1900)
        .setPlaceholder('You can use markdown features, use the tag for external emojis')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph),
}