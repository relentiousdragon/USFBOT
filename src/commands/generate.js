const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../../config.json');
const GOOGLE_TENOR = config.GOOGLE_TENOR_API_KEY;

const versions = ["20240206", "20230216", "20221001", "20201001"];

function emojiToUnicode(emoji) {
  return [...emoji]
    .map(char => {
      const codepoint = char.codePointAt(0).toString(16);
      return codepoint === "fe0f" ? "" : `u${codepoint}`;
    })
    .join("_");
}

function stripVariationSelectors(emoji) {
  return emoji.replace(/\uFE0F/g, "");
}

async function findValidEmojiImage(emoji1, emoji2) {
  const unicode1 = emojiToUnicode(emoji1);
  const unicode2 = emojiToUnicode(emoji2);
  for (const version of versions) {
    const url = `https://www.gstatic.com/android/keyboard/emojikitchen/${version}/${unicode1}/${unicode1}_${unicode2}.png`;
    try {
      const response = await axios.head(url);
      if (response.status === 200) return url;
    } catch {}
  }
  return null;
}

async function getEmojiUrl(primary1, primary2, emoji1, emoji2) {
  let emojiUrl = await findValidEmojiImage(primary1, primary2);
  if (!emojiUrl) {
    const stripped1 = stripVariationSelectors(primary1);
    const stripped2 = stripVariationSelectors(primary2);
    emojiUrl = await findValidEmojiImage(stripped1, stripped2);
  }
  if (!emojiUrl) {
    const stripped1 = stripVariationSelectors(primary1);
    const stripped2 = stripVariationSelectors(primary2);
    emojiUrl = await findValidEmojiImage(stripped2, stripped1);
  }
  if (!emojiUrl && GOOGLE_TENOR) {
    const query = `${emoji1}_${emoji2}`;
    const url = `https://tenor.googleapis.com/v2/featured?key=${GOOGLE_TENOR}&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v6&q=${query}`;
    try {
      const response = await axios.get(url);
      const data = response.data;
      if (data.results && data.results.length > 0) {
        emojiUrl = data.results[0].media_formats.png_transparent.url;
      }
    } catch {}
  }
  return emojiUrl;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generate')
    .setDescription('Generate things using USF Bot')
    .addSubcommand(sub =>
      sub.setName('emoji')
        .setDescription('Combine two emojis using Emoji Kitchen')
        .addStringOption(opt =>
          opt.setName('emoji1')
            .setDescription('First emoji')
            .setRequired(true)
            .setMaxLength(10)
        )
        .addStringOption(opt =>
          opt.setName('emoji2')
            .setDescription('Second emoji')
            .setRequired(true)
            .setMaxLength(10)
        )
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'emoji') {
      const emoji1 = interaction.options.getString('emoji1').trim();
      const emoji2 = interaction.options.getString('emoji2').trim();
      const emojiRegex = /^[\p{Extended_Pictographic}\uFE0F]+$/u;
      if (!emojiRegex.test(emoji1) || !emojiRegex.test(emoji2)) {
        await interaction.reply({
          content: '❌ One or more of your emojis are not supported!',
          ephemeral: true
        });
        return;
      }
      await interaction.deferReply();
      const emojiUrl = await getEmojiUrl(emoji1, emoji2, emoji1, emoji2);
      if (!emojiUrl) {
        await interaction.editReply({
          content: '❌ No emoji combination found!',
          ephemeral: true
        });
        return;
      }
      const botAvatar = interaction.client.user.displayAvatarURL();
      const embed = new EmbedBuilder()
        .setImage(emojiUrl)
        .setColor(0x5bd91c)
        .setFooter({
          text: 'USF Bot',
          iconURL: botAvatar
        });
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
