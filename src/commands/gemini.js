const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const axios = require('axios');
const { gemini_key } = require('../../config.json');
const { filterQuery } = require('./search.js');
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('gemini')
    .setDescription('Ask Google Gemini (AI) a question')
    .addStringOption(opt =>
      opt.setName('prompt').setDescription('Your question or prompt for Gemini AI').setRequired(true).setMaxLength(500)
    ),
  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    const username = interaction.user.username;
    const systemPrompt = `You are a helpful assistant for Discord. Always keep your response under 2000 characters and avoid any explicit, unsafe, or inappropriate content. If the user asks for anything unsafe, politely refuse. You may use Discord markdown (such as # for headings ## for headings2 and ### h3, and -# for small text and - for bullet points and   -  for bullet bullet points etc) to format your response (excluding system responses like embed color/image) as your response will be sent in a Discord channel.\n\nThe user's Discord username is: ${username}.\n\nFor every response, output the following as the first lines (each on its own line):\n1. A direct image URL for the embed thumbnail (or 'Default' if you don't have a suitable, safe image)\n2. A valid hex color code for the embed (e.g. #4285F4), or 'Default' if you don't have a suitable, safe color.\n3. (Optional, up to 5 lines) If you want to provide up to 5 relevant links as buttons, output each on its own line in the format: [Button Text](https://link) (e.g. [Official Website](https://example.com)). Only include safe, direct links. If you have no links, skip this section.\nAfter these lines, output your actual answer as usual. If you don't have a suitable value for any line, just write 'Default' for that line. Do not explain these lines, just output them as the first lines (image, color, and optional button links). Also provide proper image, for example if topic is minecraft, use a valid minecraft image logo.\nNote that the user cannot reply to you again after this, so let them know all they need to know in one response.`;
    const fullPrompt = `${systemPrompt}\nUser: ${prompt}`;
    const safetySettings = [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ];
    const loadingContainer = new ContainerBuilder()
      .setAccentColor(0x4285F4)
      .addSectionComponents(
        new SectionBuilder()
          .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Google_Bard_logo.svg/2048px-Google_Bard_logo.svg.png'))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# <:i_gemini:1371166211030650881> Gemini is thinking...\n-# Gemini 2.0 FLASH`)
          )
      );
    await interaction.reply({ components: [loadingContainer], flags: MessageFlags.IsComponentsV2 });

    async function isValidImageUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
      try {
        const u = new URL(url);
        if (!u.protocol.startsWith('http')) return false;
        if (!exts.some(ext => u.pathname.toLowerCase().endsWith(ext))) return false;
        const res = await axios.head(url, { timeout: 2500 });
        const type = res.headers['content-type'] || '';
        return type.startsWith('image/');
      } catch {
        return false;
      }
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini_key}`;
      const response = await axios.post(url, {
        contents: [
          {
            parts: [
              { text: fullPrompt }
            ]
          }
        ],
        safetySettings
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
      let [thumbLine, colorLine, ...restLines] = text.split('\n');
      while (thumbLine !== undefined && thumbLine.trim() === '') {
        [thumbLine, colorLine, ...restLines] = [colorLine, ...restLines];
      }
      while (colorLine !== undefined && colorLine.trim() === '') {
        [colorLine, ...restLines] = restLines;
      }
      let buttonLines = [];
      while (restLines.length && buttonLines.length < 5) {
        const line = restLines[0].trim();
        if (/^\[.{1,40}\]\(https?:\/\/.+\)$/.test(line)) {
          buttonLines.push(restLines.shift());
        } else {
          break;
        }
      }
      const buttons = buttonLines.map(line => {
        const match = line.match(/^\[(.{1,40})\]\((https?:\/\/.+)\)$/);
        if (!match) return null;
        let [ , label, url ] = match;
        if (!/^https?:\/\//.test(url) || /javascript:|discord:\/\//i.test(url)) return null;
        label = label.slice(0, 40);
        return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
      }).filter(Boolean);
      let safeThumb = (thumbLine && thumbLine.trim().toLowerCase() !== 'default' && isValidImageUrl(thumbLine.trim())) ? thumbLine.trim() : 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Google_Bard_logo.svg/2048px-Google_Bard_logo.svg.png';
      let safeColor = (colorLine && colorLine.trim().toLowerCase() !== 'default' && /^#([0-9a-f]{6})$/i.test(colorLine.trim())) ? colorLine.trim() : '#4285F4';
      async function validateImageUrl(url) {
        try {
          const head = await axios.head(url, { timeout: 4000 });
          const type = head.headers['content-type'] || '';
          if (head.status === 200 && type.startsWith('image/')) return true;
        } catch (e) {}
        return false;
      }
      if (safeThumb !== 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Google_Bard_logo.svg/2048px-Google_Bard_logo.svg.png') {
        const valid = await validateImageUrl(safeThumb);
        if (!valid) {
          console.log('Gemini thumbnail failed HEAD check, using default.');
          safeThumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Google_Bard_logo.svg/2048px-Google_Bard_logo.svg.png';
        }
      }
      let accentColor = parseInt(safeColor.replace('#', ''), 16);
      let answer = restLines.join('\n').trim();
      if (!answer) answer = 'No response.';
      if (answer.length > 2000) answer = answer.slice(0, 1997) + '...';
      let filteredPrompt = await filterQuery(prompt);
      if (filteredPrompt.length > 80) filteredPrompt = filteredPrompt.slice(0, 77) + '...';
      const resultContainer = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(
          new SectionBuilder()
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(safeThumb))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`# <:i_gemini:1371166211030650881> Gemini\n-# Prompt: ${filteredPrompt}`)
            )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(answer)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# USF Bot - Answers from Gemini may not be accurate, please double check it.')
        );
      if (buttons.length > 0) {
        const actionRow = new ActionRowBuilder().addComponents(...buttons);
        resultContainer.addActionRowComponents(actionRow);
      }
      await interaction.editReply({ components: [resultContainer], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      let msg = '❌ Error talking to Gemini, please double check your prompt and try again later.';
      const config = require('../../config.json');
      const team = config.team || [];
      if (team.includes(interaction.user.username)) {
        if (err && err.stack) msg += `\nStack: ${err.stack}`;
        if (err && err.message) msg += `\nMessage: ${err.message}`;
        if (err && err.response && err.response.data) {
          msg += `\nResponse: ${JSON.stringify(err.response.data, null, 2)}`;
        }
      }
      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addSectionComponents(
          new SectionBuilder()
            .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Google_Bard_logo.svg/2048px-Google_Bard_logo.svg.png'))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`# <:i_gemini:1371166211030650881> Gemini\n-# Timestamp <t:${Math.floor(Date.now()/1000)}:R>`)
            )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(msg)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# USF Bot - Answers from Gemini may not be accurate, please double check it.')
        );
      await interaction.editReply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 });
    }
  }
};
