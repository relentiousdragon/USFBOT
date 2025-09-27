const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const axios = require('axios');
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Generate a random meme')
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply();

        const getMemeEmbed = async () => {
            try {
                const response = await axios.get('https://meme-api.com/gimme');
                const meme = response.data;

                return new EmbedBuilder()
                    .setTitle(meme.title)
                    .setImage(meme.url)
                    .setFooter({
                        text: 'USF Bot',
                        iconURL: interaction.client.user.displayAvatarURL({ size: 32 })
                    })
                    .setTimestamp();
            } catch (error) {
                console.error('Error during meme fetch:', error);
                return new EmbedBuilder()
                    .setTitle('⚠️ Failed to fetch meme')
                    .setDescription('Please try again later.')
                    .setColor(0xE74C3C)
                    .setFooter({
                        text: 'USF Bot',
                        iconURL: interaction.client.user.displayAvatarURL({ size: 32 })
                    })
                    .setTimestamp();
            }
        };

        const memeEmbed = await getMemeEmbed();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`meme_refresh_${interaction.user.id}`)
                .setLabel('New Meme')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.editReply({ embeds: [memeEmbed], components: [row] });
    },

    async handleButton(interaction) {
        const [prefix, , ownerId] = interaction.customId.split('_');

        if (prefix !== 'meme') return;

        if (interaction.user.id !== ownerId) {
            const response = await axios.get('https://meme-api.com/gimme');
            const meme = response.data;

            const memeEmbed = new EmbedBuilder()
                .setTitle(meme.title)
                .setImage(meme.url)
                .setFooter({
                    text: 'USF Bot',
                    iconURL: interaction.client.user.displayAvatarURL({ size: 32 })
                })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`meme_refresh_${interaction.user.id}`)
                    .setLabel('New Meme')
                    .setStyle(ButtonStyle.Primary)
            );

            return interaction.reply({
                embeds: [memeEmbed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }

        const response = await axios.get('https://meme-api.com/gimme');
        const meme = response.data;

        const memeEmbed = new EmbedBuilder()
            .setTitle(meme.title)
            .setImage(meme.url)
            .setFooter({
                text: 'USF Bot',
                iconURL: interaction.client.user.displayAvatarURL({ size: 32 })
            })
            .setTimestamp();

        return interaction.update({ embeds: [memeEmbed] });
    }
};
