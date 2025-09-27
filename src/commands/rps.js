const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const choices = ['rock','paper','scissors'];

function winner(a, b) {
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

    if (player2) {
      const challengeEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Rock Paper Scissors Challenge')
        .setDescription(`${player1.username} has challenged **${player2.username}**!\nDo you accept?`);

      const challengeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rps_accept').setLabel('✅ Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('rps_decline').setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.reply({ embeds: [challengeEmbed], components: [challengeRow], fetchReply: true });

      const challengeCollector = msg.createMessageComponentCollector({
        time: 30000,
        filter: (i) => i.user.id === player2.id
      });

      challengeCollector.on('collect', async i => {
        if (i.customId === 'rps_accept') {
          await i.update({ content: 'Challenge accepted! Game starting...', embeds: [], components: [] });
          challengeCollector.stop('accepted');
          startGame(interaction, player1, player2);
        } else if (i.customId === 'rps_decline') {
          await i.update({ content: `${i.user.username} declined the challenge.`, embeds: [], components: [] });
          challengeCollector.stop('declined');
        }
      });

      challengeCollector.on('end', async (_, reason) => {
        if (reason !== 'accepted' && reason !== 'declined') {
          try {
            await interaction.editReply({ content: `${player2.username} did not respond in time.`, embeds: [], components: [] });
          } catch {}
        }
      });

    } else {
      await interaction.reply({ content: 'Game vs Bot starting...' });
      startGame(interaction, player1, null);
    }
  }
};

async function startGame(interaction, player1, player2) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 Rock').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 Paper').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ Scissors').setStyle(ButtonStyle.Primary)
  );

  const introText = player2
    ? `${player1.username} vs ${player2.username} — make your choices!`
    : `${player1.username} vs Bot — make your choice!`;

  const msg = await interaction.editReply({ content: introText, components: [row], fetchReply: true });

  const picks = {};

  const collector = msg.createMessageComponentCollector({
    time: 30000,
    filter: (i) => {
      if (player2) {
        if (i.user.id === player1.id || i.user.id === player2.id) return true;
        i.reply({ content: 'This isn’t your game!', ephemeral: true }).catch(() => {});
        return false;
      }
      if (i.user.id === player1.id) return true;
      i.reply({ content: 'This isn’t your game!', ephemeral: true }).catch(() => {});
      return false;
    }
  });

  collector.on('collect', async i => {
    const pick = i.customId.split('_')[1];
    if (picks[i.user.id]) {
      try { await i.reply({ content: 'You already picked.', ephemeral: true }); } catch {}
      return;
    }
    picks[i.user.id] = pick;
    try { await i.deferUpdate(); } catch {}

    if (!player2) {
      const botPick = choices[Math.floor(Math.random() * 3)];
      const w = winner(pick, botPick);
      let out;
      if (w === 'draw') out = `Draw — both chose ${pick}`;
      else if (w === 'a') out = `${player1.username} wins! ${pick} beats ${botPick}`;
      else out = `Bot wins — ${botPick} beats ${pick}`;

      await disableButtons(interaction, out);
      collector.stop();
      return;
    }

    if (picks[player1.id] && picks[player2.id]) {
      const a = picks[player1.id];
      const b = picks[player2.id];
      const w = winner(a, b);
      let out;
      if (w === 'draw') out = `Draw — both chose ${a}`;
      else if (w === 'a') out = `${player1.username} wins! ${a} beats ${b}`;
      else out = `${player2.username} wins! ${b} beats ${a}`;

      await disableButtons(interaction, out);
      collector.stop();
    }
  });

  collector.on('end', async () => {
    if (Object.keys(picks).length === 0) {
      await disableButtons(interaction, 'No one picked — match ended.');
    }
  });
}

async function disableButtons(interaction, content) {
  const disabled = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 Paper').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );
  await interaction.editReply({ content, components: [disabled] });
}
