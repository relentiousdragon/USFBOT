const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { discord } = require('../../config.json');
const fs = require('fs')
//
module.exports = {
    data: new SlashCommandBuilder()
    	.setName('mcstatus').setDescription('Get the status of a Minecraft Server')
    	.addStringOption(option=>option.setName('address').setDescription('IP Address of the Minecraft server').setRequired(true))
        .addStringOption(option=>option.setName('edition').setDescription('Edition of the Minecraft server (default java)').setRequired(false))
    	.setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const host = interaction.options.getString('address');
        const edition = interaction.options.getString('edition') ?? 'java';
        const editionList = ['java', 'bedrock'];
        if (!editionList.includes(edition)) {
            return interaction.editReply({ content: `Invalid edition! Please choose either **java** or **bedrock**`, flags: MessageFlags.Ephemeral });
        }
        const getStatus = async (link) => {
            try {
                const response = await axios.get(`${link}`);
                const data = response.data;
                let status = {
                    maxplayers: data.players.max,
                    players: data.players.online,
                    version: data.version,
                    protocol: data.protocol.version,
                    motd: data.motd.clean
                }
                return status;
            } catch (error) {
                return 0;
            }
        }
        //
        let status;
        if (edition === 'java') {
            status = await getStatus(`https://api.mcsrvstat.us/3/${host}`);
        } else if (edition === 'bedrock') {
            status = await getStatus(`https://api.mcsrvstat.us/bedrock/3/${host}`);
        }
        if (status == 0) {
            return interaction.editReply({ content: `The server does not exist` });
        }
        let online = 'Online';
        if ( status.maxplayers == 0 ) {
            online = 'Offline';
        }
        const statusEmbed = new EmbedBuilder()
            .setColor(0x009700)
            .setTitle(`${host.toLowerCase()} [${online}]`)
            .setDescription(`${status.motd}`)
            .addFields(
                { name: 'Players', value: `${status.players}/${status.maxplayers}`, inline: true },
                { name: 'Version', value: `${status.version}`, inline: true },
                { name: 'Protocol', value: `${status.protocol}`, inline: true },
            )
            .setFooter({ text: `USF Bot`, iconURL: `${interaction.client.user.displayAvatarURL({size:32})}`})
            .setTimestamp();
        return interaction.editReply({ embeds: [statusEmbed] });
    },
};