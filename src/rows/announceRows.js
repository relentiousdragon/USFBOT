const { ActionRowBuilder } = require('discord.js')
const { title, description } = require('../textinputs/announceText.js')
//
module.exports = {
    tit: new ActionRowBuilder().addComponents(title),
    desc: new ActionRowBuilder().addComponents(description),
}