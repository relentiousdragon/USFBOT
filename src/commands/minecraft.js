const { EmbedBuilder, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('minecraft')
        .setDescription('Minecraft utilities')
        .addSubcommand(sub =>
            sub.setName('server')
                .setDescription('Get the status of a Minecraft Server')
                .addStringOption(option =>
                    option.setName('address')
                        .setDescription('IP Address of the Minecraft server')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('edition')
                        .setDescription('Edition of the Minecraft server (default java)')
                        .addChoices(
                            { name: 'Java', value: 'java' },
                            { name: 'Bedrock', value: 'bedrock' }
                        )
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('skin')
                .setDescription('Get the skin of a Minecraft player')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Minecraft username or UUID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Render type')
                        .addChoices(
                            { name: 'Headshot', value: 'headshot' },
                            { name: 'Full Body', value: 'full-body' },
                            { name: 'Skin File', value: 'skin' },
                            { name: '3D Head', value: 'head' },
                            { name: 'Cape', value: 'cape' }
                        )
                        .setRequired(true))
        )
        .setDMPermission(false),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'server') {
            await interaction.deferReply();

            const host = interaction.options.getString('address');
            const edition = interaction.options.getString('edition') ?? 'java';

            const getStatus = async (link) => {
                try {
                    const response = await axios.get(link);
                    const data = response.data;
                    return {
                        maxplayers: data.players.max,
                        players: data.players.online,
                        version: data.version,
                        protocol: data.protocol.version,
                        motd: data.motd.clean,
                        icon: data.icon
                    };
                } catch {
                    return null;
                }
            };

            let status;
            if (edition === 'java') {
                status = await getStatus(`https://api.mcsrvstat.us/3/${host}`);
            } else {
                status = await getStatus(`https://api.mcsrvstat.us/bedrock/3/${host}`);
            }

            if (!status) {
                return interaction.editReply({ content: `❌ The server does not exist or is unreachable.` });
            }

            let online = status.maxplayers > 0 ? 'Online' : 'Offline';

            const statusEmbed = new EmbedBuilder()
                .setColor(0x009700)
                .setTitle(`${host.toLowerCase()} [${online}]`)
                .setDescription(status.motd || 'No MOTD')
                .addFields(
                    { name: 'Players', value: `${status.players}/${status.maxplayers}`, inline: true },
                    { name: 'Version', value: `${status.version}`, inline: true },
                    { name: 'Protocol', value: `${status.protocol}`, inline: true }
                )
                .setFooter({ text: `USF Bot`, iconURL: interaction.client.user.displayAvatarURL({ size: 32 }) })
                .setTimestamp();

            if (status.icon) {
                statusEmbed.setThumbnail(status.icon);
            }

            return interaction.editReply({ embeds: [statusEmbed] });
        }

        if (subcommand === 'skin') {
            await interaction.deferReply();

            const username = interaction.options.getString('username');
            const type = interaction.options.getString('type');

            const resolvePlayer = async (identifier) => {
                try {
                    const res = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${identifier}`);
                    if (!res.data?.id) return null;

                    const uuid = res.data.id;
                    const name = res.data.name;

                    return {
                        uuid,
                        username: name,
                        skin: `https://crafatar.com/skins/${uuid}`
                    };
                } catch {
                    return null;
                }
            };

            const player = await resolvePlayer(username);
            if (!player) {
                return interaction.editReply({ content: `❌ Could not find player details for \`${username}\`.` });
            }

            const { uuid, username: resolvedName, skin } = player;
            const baseUrl = "https://crafatar.com";
            let imageUrl;

            switch (type) {
                case "headshot":
                    imageUrl = `${baseUrl}/avatars/${uuid}.png?size=128&overlay`;
                    break;
                case "full-body":
                    imageUrl = `${baseUrl}/renders/body/${uuid}.png?scale=6&overlay`;
                    break;
                case "skin":
                    imageUrl = `${baseUrl}/skins/${uuid}`;
                    break;
                case "head":
                    imageUrl = `${baseUrl}/renders/head/${uuid}.png?scale=6&overlay`;
                    break;
                case "cape":
                    imageUrl = `${baseUrl}/capes/${uuid}.png`;
                    break;
                default:
                    return interaction.editReply({ content: `❌ Invalid type parameter.` });
            }

            const skinEmbed = new EmbedBuilder()
                .setTitle(`Minecraft Player ${type.replace("-", " ")} for \`${resolvedName}\``)
                .setImage(`https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`)
                .setColor(0x4bbf6a)
                .setFooter({ text: `USF Bot`, iconURL: interaction.client.user.displayAvatarURL({ size: 32 }) })
                .setTimestamp();

            const components = skin
                ? [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("Download Skin")
                        .setStyle(ButtonStyle.Link)
                        .setURL(skin)
                )]
                : [];

            return interaction.editReply({ embeds: [skinEmbed], components });
        }
    }
};
