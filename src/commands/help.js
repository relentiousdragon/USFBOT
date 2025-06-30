const { ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags, ContainerBuilder } = require('discord.js');
const { discord, botinvite, terms, privacy, commands, website, image, status, version } = require('../../config.json');
//
module.exports = {
    data: new SlashCommandBuilder()
    	.setName('help').setDescription('Get commands and info about the bot').setDMPermission(true),
    async execute(interaction) {
		await interaction.deferReply();
        const Discord = new ButtonBuilder()
        	.setLabel('Discord')
      		.setURL(`${discord}`)
      		.setStyle(ButtonStyle.Link)
      		.setEmoji('<:th_clyde:1143285999586267207>');
		const helpContainer = new ContainerBuilder()
			.setAccentColor(0x0007ff)
			.addSectionComponents( component => 
				component.addTextDisplayComponents(components => components.setContent(`**Bot Prefix:** \`/\`\n**Terms of Service:** [\`Link\`](${terms})\n**Privacy Policy:** [\`Link\`](${privacy})\n**Support Server:** [\`Link\`](${discord})\n**Commands List:** [\`Link\`](${commands})\n**Organization Website:** [\`Link\`](${website})\n**Status Page:** [\`Link\`](${status})\n**Invite Link:** [\`Link\`](${botinvite})`))
				.setThumbnailAccessory(components => components.setURL(image))
			)
			.addActionRowComponents(component => component.addComponents(Discord))
			.addTextDisplayComponents(component => component.setContent(`-# Version ${version}`));
		//
        await interaction.editReply({ components: [helpContainer], flags: MessageFlags.IsComponentsV2 });
    },
};