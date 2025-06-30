const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const axios = require('axios');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

const cooldowns = new Map(); 
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('dictionary')
    .setDescription('Look up the definition of a word')
    .addStringOption(opt =>
      opt.setName('word')
        .setDescription('The word to define')
        .setRequired(true)
        .setMaxLength(100)
    ),
  async execute(interaction) {
    const word = interaction.options.getString('word');
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const loadingContainer = new ContainerBuilder()
      .setAccentColor(0x0074D9)
      .addSectionComponents(
        new SectionBuilder()
          .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://cdn-icons-png.flaticon.com/512/2991/2991148.png'))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 📖 Dictionary is looking up...\n-# Please wait`)
          )
      );
    await interaction.reply({ components: [loadingContainer], flags: MessageFlags.IsComponentsV2 });
    try {
      const response = await axios.get(apiUrl);
      const data = response.data[0];
      const phonetic = data.phonetic || (data.phonetics && data.phonetics[0]?.text) || '';
      const audio = (data.phonetics && data.phonetics.find(p => p.audio))?.audio;
      const meanings = data.meanings || [];
      let defText = meanings.map(meaning => {
        let defs = meaning.definitions.slice(0, 5).map((def, i) => {
          let line = `**${i+1}.** ${def.definition}`;
          if (def.example) line += `\n> _${def.example}_`;
          return line;
        }).join('\n\n');
        let syns = meaning.synonyms && meaning.synonyms.length ? `\n> **Synonyms:** ${meaning.synonyms.slice(0, 5).join(', ')}` : '';
        let ants = meaning.antonyms && meaning.antonyms.length ? `\n> **Antonyms:** ${meaning.antonyms.slice(0, 5).join(', ')}` : '';
        return `*${meaning.partOfSpeech}*${syns}${ants}\n${defs}`;
      }).join('\n\n');
      if (!defText) defText = 'No definitions found.';
      let truncated = false;
      if (defText.length > 3000) {
        defText = defText.slice(0, 2990) + '\n...';
        truncated = true;
      }
      let section;
      const filterQuery = require('./search.js').filterQuery;
      const safeWord = await filterQuery(word);
      const profanityDetected = safeWord !== word;
      if (audio) {
        const pronounceBtn = new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel('🔊 Pronunciation')
          .setCustomId(`dictionary_pronounce_${encodeURIComponent(word)}_${interaction.user.id}`)
          .setDisabled(profanityDetected);
        section = new SectionBuilder()
          .setButtonAccessory(pronounceBtn)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 📖 ${data.word}${phonetic ? ` (${phonetic})` : ''}`)
          );
      } else {
        section = new SectionBuilder()
          .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://cdn-icons-png.flaticon.com/512/2991/2991148.png'))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 📖 ${data.word}${phonetic ? ` (${phonetic})` : ''}`)
          );
      }
      const resultContainer = new ContainerBuilder()
        .setAccentColor(0x0074D9)
        .addSectionComponents(section)
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(defText)
        );
      if (truncated) {
        resultContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# Output truncated for length. Use a more specific word or part of speech for more detail.')
        );
      }
      if (Array.isArray(data.sourceUrls) && data.sourceUrls.length > 0) {
        const sourceButtons = data.sourceUrls.slice(0, 5).map((url, i) =>
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel(data.sourceUrls.length === 1 ? 'Source' : `Source ${i+1}`)
            .setURL(url)
        );
        const sourceRow = new ActionRowBuilder().addComponents(...sourceButtons);
        resultContainer.addActionRowComponents(sourceRow);
      }
      let footer = '';
      if (profanityDetected) {
        footer += '-# **This word may be considered offensive or inappropriate.**\n';
      }
      footer += '-# USF Bot - Dictionary';
      resultContainer.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      ).addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footer)
      );
      await interaction.editReply({ components: [resultContainer], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      let msg = '❌ Error: Could not find that word.';
      if (err.response && err.response.data && err.response.data.title) {
        msg += `\n${err.response.data.title}`;
      }
      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addSectionComponents(
          new SectionBuilder()
            .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://cdn-icons-png.flaticon.com/512/2991/2991148.png'))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`# USF Bot - Dictionary`)
            )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(msg)
        );
      await interaction.editReply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 });
    }
  }
};

async function handlePronunciationButton(interaction) {
  const customId = interaction.customId;
  const match = customId.match(/^dictionary_pronounce_(.+)_(\d+)$/);
  if (!match) return;
  const word = decodeURIComponent(match[1]);
  const userId = match[2];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: '❌ Only the user who used the command can use this button.', ephemeral: true });
    return;
  }
  const now = Date.now();
  if (cooldowns.has(userId) && now - cooldowns.get(userId) < 10000) {
    await interaction.reply({ content: '⏳ Please wait before using this again.', ephemeral: true });
    return;
  }
  cooldowns.set(userId, now);
  const member = await interaction.guild.members.fetch(userId);
  const vc = member.voice.channel;
  if (!vc) {
    await interaction.reply({ content: '❌ You must be in a voice channel to hear the pronunciation.', ephemeral: true });
    return;
  }
  let url;
  try {
    url = googleTTS.getAudioUrl(word, { lang: 'en', slow: false, host: 'https://translate.google.com' });
  } catch {
    await interaction.reply({ content: '❌ Could not generate pronunciation.', ephemeral: true });
    return;
  }
  const connection = joinVoiceChannel({
    channelId: vc.id,
    guildId: vc.guild.id,
    adapterCreator: vc.guild.voiceAdapterCreator
  });
  const player = createAudioPlayer();
  const resource = createAudioResource(url);
  connection.subscribe(player);
  await interaction.reply({ content: `🔊 Pronunciation for **${word}** played in <#${vc.id}>.`, ephemeral: true });
  player.play(resource);
  try {
    await entersState(player, AudioPlayerStatus.Playing, 5000);
    await entersState(player, AudioPlayerStatus.Idle, 15000);
  } catch {}
  player.stop();
  connection.destroy();
}

module.exports.handlePronunciationButton = handlePronunciationButton;
