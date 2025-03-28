const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder, MessageFlags } = require('discord.js');
//
module.exports = {
    data: new SlashCommandBuilder()
    	.setName('prune').setDescription('Prune messages in a channel, up to 200')
    	.addStringOption(option=>option.setName('amount').setDescription('Amount of messages to prune').setRequired(true))
    	.setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            const amount = interaction.options.getInteger('amount');
            if (amount<0||amount>200) {
                interaction.editReply({content: 'You are allowed to prune up to 200 messages.', flags: MessageFlags.Ephemeral});
            }
            interaction.channel.bulkDelete(amount, true).catch(error=> {
        		console.error(error)
        		const { erbed } = require('../embeds/embeds.js')
                erbed.setFooter(`${error}`)
                return interaction.editReply({ embeds: [erbed] })
		  	});
            const prunEmbed = new EmbedBuilder()
            	.setDescription(`Successfully pruned \`${amount}\` messages.`);
            return interaction.editReply({embeds: [prunEmbed], flags: MessageFlags.Ephemeral});
        } else {
            return interaction.editReply({content: 'Unauthorized', flags: MessageFlags.Ephemeral});
        }
    },
};