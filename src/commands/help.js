const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { discord, botinvite, terms, privacy, commands, website, image, status } = require('../../config.json');
//
module.exports = {
    data: new SlashCommandBuilder()
    	.setName('help').setDescription('Get commands and info about the bot').setDMPermission(true),
    async execute(interaction) {
		await interaction.deferReply();
        const user = interaction.user;
        const helpEmbed = new EmbedBuilder()
        	.setColor(0x0000ff)
        	.setTitle('USFBot Informations')
        	.setDescription(`**Bot Prefix:** \`/\`\n**Terms of Service:** [\`Link\`](${terms})\n**Privacy Policy:** [\`Link\`](${privacy})\n**Support Server:** [\`Link\`](${discord})\n**Commands List:** [\`Link\`](${commands})\n**Organization Website:** [\`Link\`](${website})\n**Status Page:** [\`Link\`](${status})\n**Invite Link:** [\`Link\`](${botinvite})`)
        	.setThumbnail(`${image}`)
        	.setFooter({text: `Version 2.0.5.1`, iconURL: `${interaction.client.user.displayAvatarURL({size:32})}`})
        	.setTimestamp();
        const Discord = new ButtonBuilder()
        	.setLabel('Discord')
      		.setURL(`${discord}`)
      		.setStyle(ButtonStyle.Link)
      		.setEmoji('<:th_clyde:1143285999586267207>');
        const row = new ActionRowBuilder()
        	.addComponents(Discord);
        interaction.editReply({components: [row], embeds: [helpEmbed]});
    },
};