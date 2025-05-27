const { EmbedBuilder } = require('discord.js')
const { discord, terms, github, website, image } = require('../../config.json')
//
module.exports = {
    guildNotAllowed: new EmbedBuilder()
        .setTitle('This guild is not allowed to use this Bot!')
        .setDescription(`We are sorry but this guild is not allowed to use the USF Bot.\n\nThis usually happens when guild members break our [Terms of Service](${terms})\nIf you believe this is an error and you are the guild owner, you can appeal in our [Discord Server](${discord}).`),
    userNotAllowed: new EmbedBuilder()
        .setTitle('You are not allowed to use this Bot!')
        .setDescription(`We are sorry but you are not allowed to use the USF Bot.\n\nThis usually happens when you break our [Terms of Service](${terms})\nIf you believe this is an error, you can appeal in our [Discord Server](${discord}).`),
    erbed: new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('We\'re sorry, an error occurred!')
        .setDescription(`Please wait a few seconds and try again. If the error persists, please contact us in our [Discord Server](${discord})`),
    infoEmbed: new EmbedBuilder()
        .setTitle('USF BOT by DXS International')
        .setDescription(`The USF Bot is a Multipurpose Discord Bot created with the scope of helping every Servers with **Moderation and Management**, making some actions faster with **Utility** functions and Entertain the Community with **Fun features**! \nThe Bot is __100% free__ and almost every bot functions are suggested by Communities where the bot is present.\n\nYou can find a guide in the [Discord server](${discord}) and more information on its own [Github Repository](${github}) and the [DSX Website](${website})! Product of DXS International`)
        .setColor(0x000fff)
        .setThumbnail(`${image}`),
    joinEmbed: new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Joined a new Guild'),
    leaveEmbed: new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('Left a Guild'),
}