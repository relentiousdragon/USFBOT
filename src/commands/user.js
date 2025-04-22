const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
//
module.exports = {
    data: new SlashCommandBuilder()
    	.setName('user').setDescription('Get information about a user')
    	.addUserOption(option=>option.setName('target').setDescription('User you want to view'))
    	.setDMPermission(true),
    async execute(interaction) {
        await interaction.deferReply()
        const target = interaction.options.getUser('target') ?? interaction.user;
        const user = await target.fetch({ force: true }).catch(console.error);
        if (!user) {
            return interaction.editReply({ content: 'User not found', ephemeral: true });
        }
        let created = Math.floor(target.createdTimestamp/1000)
        const userEmbed = new EmbedBuilder()
        	.setColor(user.hexAccentColor)
        	.setTitle(`${target.username} Information`)
        	.setThumbnail(`${target.displayAvatarURL({size:2048})}`)
        	.addFields(
                { name: "Username & ID", value: `${target.username} | ${target.id}` },
                { name: '\u200B', value: '\u200B' },
                { name: "Created Date", value: `<t:${created}:F>` },
            )
        	.setTimestamp()
        	.setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL({size:2048})}`});
        const avatar = new ButtonBuilder()
            .setLabel('Avatar Link')
            .setStyle(ButtonStyle.Link)
            .setURL(target.avatarURL());
        const row = new ActionRowBuilder()
            .addComponents(avatar);
        if (interaction.guild) {
            const member = interaction.options.getMember('target') ?? interaction.member;
            let joined = Math.floor(member.joinedTimestamp/1000);
            userEmbed.addFields(
                { name: 'Joined Date', value: `<t:${joined}:F>` },
            )
        }
        if (user.banner) {
            const banner = user.bannerURL({size: 2048, dynamic: true});
            userEmbed.setImage(banner)
            const bannerbutton = new ButtonBuilder()
                .setLabel('Banner Link')
                .setStyle(ButtonStyle.Link)
                .setURL(target.avatarURL());
            row.addComponents(bannerbutton);
        }
        return interaction.editReply({ embeds: [userEmbed], components: [row] });
    }
}