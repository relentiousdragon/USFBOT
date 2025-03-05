const { ActionRowBuilder, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { GOOGLE_API_KEY, GOOGLE_CSE_ID, SERPAPI_KEY } = require('../../config.json');
const SerpApi = require('google-search-results-nodejs');
const search = new SerpApi.GoogleSearch(SERPAPI_KEY);
//
async function filterQuery(query) {
  try {
    const response = await axios.get(`https://www.purgomalum.com/service/json`, {
      params: { text: query, fill_char: '-' }
    });
    return response.data.result || '[REDACTED]';
  } catch (error) {
    console.error('Purgomalum API error:', error);
    return '[REDACTED]';
  }
}
async function fetchGoogleResults(query) {
  const apiKey = GOOGLE_API_KEY;
  const cx = GOOGLE_CSE_ID;
  if (!apiKey || !cx) {
    console.error('Google API Key or CSE ID is missing.');
    return null;
  }
  try {
    const response = await axios.get(`https://www.googleapis.com/customsearch/v1`, {
      params: { key: apiKey, cx: cx, q: query, num: 5, safe: 'active' }
    });
    if (response.data.error) {
      console.error('Google API Error:', response.data.error.message);
      return null;
    }
    if (!response.data.items || response.data.items.length === 0) {
      console.log('No results found for query:', query);
      return null;
    }
    return response.data.items.slice(0, 5).map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet
    }));
  } catch (error) {
    console.error('Google API Request Failed:', error.message);
    return null;
  }
}
//
async function fetchDuckDuckGoResults(query) {
  try {
    const response = await axios.get(`https://api.duckduckgo.com/`, {
      params: { q: query, format: 'json', no_html: 1, no_redirect: 1, kp: 1, safe: 'active' }
    });
    const data = response.data;
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      return data.RelatedTopics
        .filter(rt => rt.FirstURL && rt.Text)
        .slice(0, 5)
        .map(rt => ({
          title: rt.Text,
          link: rt.FirstURL,
          snippet: rt.Text || ''
        }));
    }
    if (data.Results && data.Results.length > 0) {
      return data.Results
        .filter(result => result.FirstURL && result.Text)
        .slice(0, 5)
        .map(result => ({
          title: result.Text,
          link: result.FirstURL,
          snippet: result.Text || ''
        }));
    }
    return null;
  } catch (error) {
    console.error('DuckDuckGo API Error:', error.message);
    return null;
  }
}
//
async function fetchBingResults(query) {
  return new Promise((resolve, reject) => {
    search.json({
      engine: 'bing',
      q: query,
      count: 5,
      safe: 'active'
    }, (result) => {
      if (result?.error) {
        return reject(new Error(result.error));
      }
      if (result?.organic_results) {
        resolve(result.organic_results.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet
        })));
      } else {
        resolve(null);
      }
    });
  });
}
//
async function fetchYahooResults(query) {
  return new Promise((resolve, reject) => {
    search.json({
      engine: 'yahoo',
      p: query,
      count: 5,
      vm: 'r',
      safe: 'active'
    }, (result) => {
      if (result?.error) {
        return reject(new Error(result.error));
      }
      if (result?.organic_results) {
        resolve(result.organic_results.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet
        })));
      } else {
        resolve(null);
      }
    });
  });
}
//
async function fetchYandexResults(query) {
  return new Promise((resolve, reject) => {
    search.json({
      engine: 'yandex',
      text: query,
      num: 5,
      safe: 'active'
    }, (result) => {
      if (result?.error) {
        return reject(new Error(result.error));
      }
      if (result?.organic_results) {
        resolve(result.organic_results.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet
        })));
      } else {
        resolve(null);
      }
    });
  });
}
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('search').setDescription('Search the web')
    .addStringOption(option => option.setName('query').setDescription('What to search for').setRequired(true).setMaxLength(100))
    .addStringOption(option => option.setName('deepsearch').setDescription('Search the web deeply').setRequired(false).addChoices(
      { name: 'Google', value: 'google' },
      { name: 'DuckDuckGo', value: 'duckduckgo' },
      { name: 'Bing', value: 'bing' },
      { name: 'Yandex', value: 'yandex' },
      { name: 'Yahoo', value: 'yahoo' }
    ))
    .setDMPermission(false),
  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query');

    /* if (badWords.some(word => query.toLowerCase().includes(word))) {
      return interaction.editReply("Unable to search for your requested query.\n-# Requested query contains prohibited words.");
    } */

    const safeQuery = await filterQuery(query);
    const deepsearch = interaction.options.getString('deepsearch');
    const encodedQuery = encodeURIComponent(query);
    const profanityDetected = safeQuery !== query;

    if (deepsearch) {
      const engine = [
        {
          name: 'Google',
          url: `https://google.com/search?q=${encodedQuery}`,
          api: fetchGoogleResults,
          color: 0x4285F4,
          emoji: '<:google:1266016555662184606>',
          enabled: !!GOOGLE_API_KEY && !!GOOGLE_CSE_ID,
          preloaded: true
        },
        {
          name: 'DuckDuckGo',
          url: `https://duckduckgo.com/?q=${encodedQuery}`,
          api: fetchDuckDuckGoResults,
          color: 0xDE5833,
          emoji: '<:duckduckgo:1266021571508572261>',
          enabled: true,
          preloaded: true
        },
        {
          name: 'Bing',
          url: `https://bing.com/search?q=${encodedQuery}`,
          api: fetchBingResults,
          color: 0x00809D,
          emoji: '<:bing:1266020917314850907>',
          enabled: !!SERPAPI_KEY,
          preloaded: false
        },
        {
          name: 'Yandex',
          url: `https://yandex.com/search/?text=${encodedQuery}`,
          api: fetchYandexResults,
          color: 0xFF0000,
          emoji: '<:yandex:1266020634484539515>',
          enabled: !!SERPAPI_KEY,
          preloaded: false
        },
        {
          name: 'Yahoo',
          url: `https://search.yahoo.com/search?p=${encodedQuery}`,
          api: fetchYahooResults,
          color: 0x720E9E,
          emoji: '<:yahoo:1266019185100718155>',
          enabled: !!SERPAPI_KEY,
          preloaded: false
        },
      ];
      //
      if (deepsearch == 'google') {
        const googleEngine = engine.find(engine => engine.name === 'Google');
        let googleResults = null;
        if (googleEngine && googleEngine.enabled && googleEngine.api) {
          try {
            googleResults = await googleEngine.api(query);
          } catch (error) {
            console.error(`Google API Error: ${error.message}`);
          }
        }
        const googleEmbed = new EmbedBuilder()
          .setColor(googleEngine.color || 0x4285F4)
          .setAuthor({ name: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setTitle(`${googleEngine.emoji} ${safeQuery}`);
        if (googleResults && googleResults.length > 0) {
          googleEmbed.setURL(engine[0].url);
          googleEmbed.setDescription(
            googleResults.map((r, i) =>
              `${i + 1}. [${r.title}](${r.link})\n${r.snippet ? `> ${r.snippet.slice(0, 150)}...` : ''}`
            ).join('\n\n')
          );
        } else {
          googleEmbed.setDescription(`No results found\n[Search for ${safeQuery} on ${googleEngine.emoji} ${googleEngine.name}](${googleEngine.url})`);
        }
        if (profanityDetected) googleEmbed.setFooter({ text: 'Results may be unsafe', iconURL:'https://cdn.discordapp.com/emojis/1341764612273737769.webp?size=64&quality=lossless' });
        await interaction.editReply({ embeds: [googleEmbed] });
        return;
      } else if (deepsearch == 'duckduckgo') {
        const duckduckgoEngine = engine.find(engine => engine.name === 'DuckDuckGo');
        let duckduckgoResults = null;
        if (duckduckgoEngine && duckduckgoEngine.enabled && duckduckgoEngine.api) {
          try {
            duckduckgoResults = await duckduckgoEngine.api(query);
          } catch (error) {
            console.error(`DuckDuckGo API Error: ${error.message}`);
          }
        }
        const duckduckgoEmbed = new EmbedBuilder()
          .setColor(duckduckgoEngine.color || 0xDE5833)
          .setAuthor({ name: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setTitle(`${duckduckgoEngine.emoji} ${safeQuery}`);
        if (duckduckgoResults && duckduckgoResults.length > 0) {
          duckduckgoEmbed.setURL(engine[1].url);
          duckduckgoEmbed.setDescription(
            duckduckgoResults.map((r, i) =>
              `${i + 1}. [${r.title}](${r.link})\n${r.snippet ? `> ${r.snippet.slice(0, 150)}...` : ''}`
            ).join('\n\n')
          );
        } else {
          duckduckgoEmbed.setDescription(`No results found\n[Search for ${safeQuery} on ${duckduckgoEngine.emoji} ${duckduckgoEngine.name}](${duckduckgoEngine.url})`);
        }
        if (profanityDetected) duckduckgoEmbed.setFooter({ text: 'Results may be unsafe', iconURL:'https://cdn.discordapp.com/emojis/1341764612273737769.webp?size=64&quality=lossless' });
        await interaction.editReply({ embeds: [duckduckgoEmbed] });
        return;
      } else if (deepsearch == 'bing') {
        const bingEngine = engine.find(engine => engine.name === 'Bing');
        let bingResults = null;
        if (bingEngine && bingEngine.enabled && bingEngine.api) {
          try {
            bingResults = await bingEngine.api(query);
          } catch (error) {
            console.error(`Bing API Error: ${error.message}`);
          }
        }
        const bingEmbed = new EmbedBuilder()
          .setColor(bingEngine.color || 0x00809D)
          .setAuthor({ name: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setTitle(`${bingEngine.emoji} ${safeQuery}`);
        if (bingResults && bingResults.length > 0) {
          bingEmbed.setURL(engine[2].url);
          bingEmbed.setDescription(
            bingResults.map((r, i) =>
              `${i + 1}. [${r.title}](${r.link})\n${r.snippet ? `> ${r.snippet.slice(0, 150)}...` : ''}`
            ).join('\n\n')
          );
        } else {
          bingEmbed.setDescription(`No results found\n[Search for ${safeQuery} on ${bingEngine.emoji} ${bingEngine.name}](${bingEngine.url})`);
        }
        if (profanityDetected) bingEmbed.setFooter({ text: 'Results may be unsafe', iconURL:'https://cdn.discordapp.com/emojis/1341764612273737769.webp?size=64&quality=lossless' });
        await interaction.editReply({ embeds: [bingEmbed] });
        return;
      } else if (deepsearch == 'yandex') {
        const yandexEngine = engine.find(engine => engine.name === 'Yandex');
        let yandexResults = null;
        if (yandexEngine && yandexEngine.enabled && yandexEngine.api) {
          try {
            yandexResults = await yandexEngine.api(query);
          } catch (error) {
            console.error(`Yandex API Error: ${error.message}`);
          }
        }
        const yandexEmbed = new EmbedBuilder()
          .setColor(yandexEngine.color || 0xFF0000)
          .setAuthor({ name: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setTitle(`${yandexEngine.emoji} ${safeQuery}`);
        if (yandexResults && yandexResults.length > 0) {
          yandexEmbed.setURL(engine[3].url);
          yandexEmbed.setDescription(
            yandexResults.map((r, i) =>
              `${i + 1}. [${r.title}](${r.link})\n${r.snippet ? `> ${r.snippet.slice(0, 150)}...` : ''}`
            ).join('\n\n')
          );
        } else {
          yandexEmbed.setDescription(`No results found\n[Search for ${safeQuery} on ${yandexEngine.emoji} ${yandexEngine.name}](${yandexEngine.url})`);
        }
        if (profanityDetected) yandexEmbed.setFooter({ text: 'Results may be unsafe', iconURL:'https://cdn.discordapp.com/emojis/1341764612273737769.webp?size=64&quality=lossless' });
        await interaction.editReply({ embeds: [yandexEmbed] });
        return;
      } else if (deepsearch == 'yahoo') {
        const yahooEngine = engine.find(engine => engine.name === 'Yahoo');
        let yahooResults = null;
        if (yahooEngine && yahooEngine.enabled && yahooEngine.api) {
          try {
            yahooResults = await yahooEngine.api(query);
          } catch (error) {
            console.error(`Yahoo API Error: ${error.message}`);
          }
        }
        const yahooEmbed = new EmbedBuilder()
          .setColor(yahooEngine.color || 0x720E9E)
          .setAuthor({ name: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setTitle(`${yahooEngine.emoji} ${safeQuery}`);
        if (yahooResults && yahooResults.length > 0) {
          yahooEmbed.setURL(engine[4].url);
          yahooEmbed.setDescription(
            yahooResults.map((r, i) =>
              `${i + 1}. [${r.title}](${r.link})\n${r.snippet ? `> ${r.snippet.slice(0, 150)}...` : ''}`
            ).join('\n\n')
          );
        } else {
          yahooEmbed.setDescription(`No results found\n[Search for ${safeQuery} on ${yahooEngine.emoji} ${yahooEngine.name}](${yahooEngine.url})`);
        }
        if (profanityDetected) yahooEmbed.setFooter({ text: 'Results may be unsafe', iconURL:'https://cdn.discordapp.com/emojis/1341764612273737769.webp?size=64&quality=lossless' });
        await interaction.editReply({ embeds: [yahooEmbed] });
        return;
      }
    } else {
      const google = `https://google.com/search?q=${encodedQuery}`;
      const duckduckgo = `https://duckduckgo.com/?q=${encodedQuery}`;
      const bing = `https://bing.com/search?q=${encodedQuery}`;
      const yandex = `https://yandex.com/search/?text=${encodedQuery}`;
      const yahoo = `https://search.yahoo.com/search?p=${encodedQuery}`;
      const brave = `https://search.brave.com/search?q=${encodedQuery}`;
      const ecosia = `https://www.ecosia.org/search?q=${encodedQuery}`;
      const qwant = `https://www.qwant.com/?q=${encodedQuery}`;
      const swisscows = `https://swisscows.com/it/web?query=${encodedQuery}`;
      const gibiru = `https://gibiru.com/results.html?q=${encodedQuery}`;
      const lilo = `https://search.lilo.org/?q=${encodedQuery}`;
      //
      const regularSearchEmbed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setAuthor({ name: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp()
        .setDescription(`<:google:1266016555662184606> [${safeQuery}](https://google.com/search?q=${encodedQuery})\n<:duckduckgo:1266021571508572261> [${safeQuery}](https://duckduckgo.com/?q=${encodedQuery})\n<:bing:1266020917314850907> [${safeQuery}](https://bing.com/search?q=${encodedQuery})\n<:yandex:1266020634484539515> [${safeQuery}](https://yandex.com/search/?text=${encodedQuery})\n<:yahoo:1266019185100718155> [${safeQuery}](https://search.yahoo.com/search?p=${encodedQuery})\n<:brave:1266017410109149287> [${safeQuery}](https://search.brave.com/search?q=${encodedQuery})\n<:ecosia:1266017707766055045> [${safeQuery}](https://www.ecosia.org/search?q=${encodedQuery})\n<:qwant:1266021495981998172> [${safeQuery}](https://www.qwant.com/?q=${encodedQuery})\n<:swisscows:1266020983651958785> [${safeQuery}](https://swisscows.com/it/web?query=${encodedQuery})\n<:gibiru:1266020402749247581> [${safeQuery}](https://gibiru.com/results.html?q=${encodedQuery})\n<:lilo:1266019331301576754> [${safeQuery}](https://search.lilo.org/?q=${encodedQuery})`);
        if (profanityDetected) regularSearchEmbed.setFooter({ text: 'Results may be unsafe', iconURL:'https://cdn.discordapp.com/emojis/1341764612273737769.webp?size=64&quality=lossless' });
        await interaction.editReply({ embeds: [regularSearchEmbed] });
      return;
    }
  }
}