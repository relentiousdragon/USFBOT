const { ChannelType, SlashCommandBuilder } = require('discord.js')
function YesNo(parameter) {
    if (parameter) {
        return 'Yes'
    } else {
        return 'No'
    }
}
const { serverinfo } = require('../embeds/serverEmbed.js')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('server').setDescription('Display info about this server'),
    async execute(interaction) {
        await interaction.deferReply()
        const guild = interaction.guild;
        const description = guild.description ?? 'This server has no description.';
        //
        const text = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText).size;
		const voice = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildVoice).size;
		const announcements = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildAnnouncement).size;
		const forum = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildForum).size;
		const stage = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildStageVoice).size;
		const channels = text+voice+announcements+forum+stage;
        const created = Math.floor(guild.createdTimestamp /1000)
        //
        let dt, depending;
		if (guild.memberCount > 1000) {
			depending = `${YesNo(guild.partnered)}`
			dt = '🤝 Partnered'
		} else {
			const TotFetch = await guild.members.fetch()
			depending = guild.members.cache.filter(member => (interaction.createdTimestamp - member.joinedTimestamp) < 86400000).size;
			dt = '🚪 Last 24h joins'
		}
        //
        let feat = '';
		let features = guild.features;
		let size = features.length;
		for (let i=0; i<size; i++) {
			feat+=`- ${features[i]}\n`
		}
        //
        serverinfo.setTitle(`${guild.name}`).setDescription(`${description}`).setFields(
            { name: '👑 Owner and Created Date', value: `<@${guild.ownerId}> | ${guild.ownerId}\n <t:${created}:F>` },
            { name: '\u200B', value: '\u200B' },
            { name: '👥 Members', value: `${guild.memberCount}/${guild.maximumMembers}`, inline: true },
            { name: '💎 Boosts', value: `${guild.premiumSubscriptionCount} (Level ${guild.premiumTier})`, inline: true },
            { name: '✅ Verified', value: `${YesNo(guild.verified)}`, inline: true },
            { name: `${dt}`, value: `${depending}`, inline: true },
            { name: ':hash: Channels', value: `${channels}`, inline: true },
            { name: '🔰 Roles', value: `${guild.roles.cache.size}`, inline: true },
            { name: '😃 Emojis', value: `${guild.emojis.cache.size}`, inline: true } ,
            { name: '🎞 Stickers', value: `${guild.stickers.cache.size}`, inline: true },
            { name: '💻 Shard', value: `${guild.shard.id}`, inline: true },
            { name: '✨ Features', value: `${feat}` }
        ).setTimestamp();
        //
        if (guild.icon) {
			serverinfo.setFooter({ text: `${guild.name}`, iconURL: `${guild.iconURL({size:32})}` });
			serverinfo.setThumbnail(guild.iconURL({size: 2048}))
		} else {
			serverinfo.setFooter({ text: `${guild.name}` });
		}
		return interaction.editReply({ embeds: [serverinfo] });
    }
}