const { ModalBuilder } = require('discord.js')
//
module.exports = {
    announce: new ModalBuilder()
        .setCustomId('announced')
        .setTitle('Announcement Text'),
}