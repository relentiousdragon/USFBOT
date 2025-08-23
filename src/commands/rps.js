const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const choices = ['rock','paper','scissors'];

function winner(a,b) {
  if (a === b) return 'draw';
  if ((a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock')) return 'a';
  return 'b';
}
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors with someone or the bot')
    .addUserOption(opt => opt.setName('opponent').setDescription('User to challenge (optional)')),
  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');
    const player1 = interaction.user;
    const player2 = opponent && opponent.id !== player1.id ? opponent : null;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rps_paper').setLabel('📄').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️').setStyle(ButtonStyle.Primary)
    );

  const introText = player2 ? `${player1.username} challenged ${player2.username} — make your choices!` : `${player1.username} vs Bot — make your choice!`;
  const msg = await interaction.reply({ content: introText, components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({
      time: 30000,
      filter: (i) => {
        if (player2) return i.user.id === player1.id || i.user.id === player2.id;
        return i.user.id === player1.id;
      }
    });

    const picks = {};

    collector.on('collect', async i => {
      try {
        const pick = i.customId.split('_')[1];
        if (picks[i.user.id]) {
          try { await i.reply({ content: 'You already picked.', ephemeral: true }); } catch {};
          return;
        }
        picks[i.user.id] = pick;
        try { await i.deferUpdate(); } catch {}

        if (!player2) {
          const botPick = choices[Math.floor(Math.random()*3)];
          const w = winner(pick, botPick);
          let out;
          if (w === 'draw') out = `Draw — both chose ${pick}`;
          else if (w === 'a') out = `${player1.username} wins! ${pick} beats ${botPick}`;
          else out = `Bot wins — ${botPick} beats ${pick}`;
          const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 Paper').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await interaction.editReply({ content: out, components: [disabled] });
          collector.stop();
          return;
        }

        if (picks[player1.id] && picks[player2.id]) {
          const a = picks[player1.id];
          const b = picks[player2.id];
          const w = winner(a,b);
          let out;
          if (w === 'draw') out = `Draw — both chose ${a}`;
          else if (w === 'a') out = `${player1.username} wins! ${a} beats ${b}`;
          else out = `${player2.username} wins! ${b} beats ${a}`;

          const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 Paper').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await interaction.editReply({ content: out, components: [disabled] });
          collector.stop();
        }
      } catch (err) {
        console.error('RPS error', err);
        try { await i.reply({ content: 'An error occurred.', ephemeral: true }); } catch {}
      }
    });

    collector.on('end', async collected => {
      try {
        if (Object.keys(picks).length === 0) {
          const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rps_paper').setLabel('📄').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await interaction.editReply({ content: 'No one picked — match ended.', components: [disabled] });
        }
      } catch (e) { /* ignore */ }
    });
  }
};