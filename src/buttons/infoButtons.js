const { ButtonBuilder, ButtonStyle } = require('discord.js')
const { discord, terms, privacy, botinvite } = require('../../config.json')
//
module.exports = {
    Discord: new ButtonBuilder()
        .setLabel('Discord')
      	.setURL(`${discord}`)
      	.setStyle(ButtonStyle.Link)
      	.setEmoji('<:discord:1316059904431095909>'),
    Invite: new ButtonBuilder()
        .setLabel('Invite')
        .setURL(`${botinvite}`)
        .setStyle(ButtonStyle.Link)
        .setEmoji('🔗'),
    Terms: new ButtonBuilder()
        .setLabel('Terms of Service')
        .setURL(`${terms}`)
        .setStyle(ButtonStyle.Link)
        .setEmoji('🛡'),
    Privacy: new ButtonBuilder()
        .setLabel('Privacy Policy')
        .setURL(`${privacy}`)
        .setStyle(ButtonStyle.Link)
        .setEmoji('🔒'),
}