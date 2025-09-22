const { MessageFlags, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder, ConnectionService } = require('discord.js');
const axios = require('axios');
const crypto = require('crypto');
const { GOOGLE_API_KEY, GOOGLE_CSE_ID, SERPAPI_KEY } = require('../../config.json');
const { getJson } = require('serpapi');

async function getLogoUrl(domain) {
  return `https://logo.clearbit.com/${domain}`;
}

async function isImageUrl(url, timeout = 2000) {
  if (!url) return false;
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    if (imageExtensions.some(ext => pathname.endsWith(ext))) return true;
  } catch {}
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeoutId);
    let contentType = response.headers.get('content-type');
    if (!contentType) return imageExtensions.some(ext => url.toLowerCase().includes(ext));
    return contentType.startsWith('image/');
  } catch {
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  }
}
const PAGINATION_CACHE = new Map(); 
const PAGINATION_TTL = 10 * 60 * 1000;

function makeSessionId(engine, query, userId) {
  const short = crypto.randomBytes(6).toString('hex');
  return `${engine}_${short}_${userId}`;
}

function setPaginationCache(sessionId, results, meta, userId) {
  PAGINATION_CACHE.set(sessionId, { timestamp: Date.now(), results, meta, userId });
}

function getPaginationCache(sessionId) {
  const entry = PAGINATION_CACHE.get(sessionId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PAGINATION_TTL) {
    PAGINATION_CACHE.delete(sessionId);
    return null;
  }
  return entry;
}

function cleanupPaginationCache() {
  const now = Date.now();
  for (const [key, entry] of PAGINATION_CACHE.entries()) {
    if (now - entry.timestamp > PAGINATION_TTL) {
      PAGINATION_CACHE.delete(key);
    }
  }
}
setInterval(cleanupPaginationCache, 60 * 1000); 

function isPaginationExpired(sessionId) {
  const entry = PAGINATION_CACHE.get(sessionId);
  if (!entry) return true;
  return Date.now() - entry.timestamp > PAGINATION_TTL;
}

function parseDuckDuckGoResults(data, query) {
  let results = [];
  if (data.Abstract && data.AbstractURL) {
    results.push({
      title: data.Heading || query,
      description: data.Abstract,
      url: data.AbstractURL,
      infobox: data.Infobox || null,
      image: data.Image || null,
      ImageWidth: data.ImageWidth || null,
      ImageHeight: data.ImageHeight || null,
      isAbstract: true
    });
  }
  if (data.Results && data.Results.length > 0) {
    results = results.concat(
      data.Results.filter(r => r.Text && r.FirstURL).map(r => ({
        title: r.Text.split(" - ")[0],
        description: r.Text,
        url: r.FirstURL
      }))
    );
  }
  if (data.RelatedTopics && data.RelatedTopics.length > 0) {
    data.RelatedTopics.forEach(item => {
      if (item.Text && item.FirstURL) {
        results.push({
          title: item.Text.split(" - ")[0],
          description: item.Text,
          url: item.FirstURL,
          isRelated: true
        });
      } else if (item.Topics && Array.isArray(item.Topics)) {
        item.Topics.forEach(subItem => {
          if (subItem.Text && subItem.FirstURL) {
            results.push({
              title: subItem.Text.split(" - ")[0],
              description: subItem.Text,
              url: subItem.FirstURL,
              isRelated: true
            });
          }
        });
      }
    });
  }
  return results;
}

function cleanInfoboxFields(fields) {
  const allowed = [
    'Born', 'Age', 'Other names', 'Education', 'Alma mater', 'Occupation', 'Years active', 'Partner(s)',
    'Twitter profile', 'Instagram profile', 'Facebook profile', 'IMDb ID', 'Wikidata description', 'Known for', 'Awards', 'Net worth'
  ];
  const socialMap = {
    'Twitter profile': v => `[Twitter](https://x.com/${v})`,
    'Instagram profile': v => `[Instagram](https://instagram.com/${v})`,
    'Facebook profile': v => `[Facebook](https://facebook.com/${v})`,
    'IMDb ID': v => {
      if (/^nm\d{7,8}$/.test(v)) return `[IMDb](https://www.imdb.com/name/${v}/)`;
      if (/^tt\d{7,8}$/.test(v)) return `[IMDb](https://www.imdb.com/title/${v}/)`;
      return `[IMDb](https://www.imdb.com/${v}/)`;
    }
  };
  return fields
    .filter(f => allowed.includes(f.label) && f.value && typeof f.value === 'string' && !f.value.startsWith('[object'))
    .map(f => {
      if (socialMap[f.label]) {
        return { name: f.label, value: socialMap[f.label](f.value), inline: true };
      }
      return { name: f.label, value: String(f.value).slice(0, 1024), inline: true };
    });
}
// STASHED
function isValidImdbId(id) {
  return /^tt\d{7,8}$/.test(id) || /^nm\d{7,8}$/.test(id);
}

async function fetchImdbRating(imdbId) {
  const OMDB_API_KEY = `f1e79fce`;
  if (!OMDB_API_KEY) return null;
  try {
    const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`;
    const res = await axios.get(url);
    if (res.data && res.data.Response === 'True' && res.data.Title) {
      return {
        rating: res.data.imdbRating && res.data.imdbRating !== 'N/A' ? res.data.imdbRating + '/10' : null,
        title: res.data.Title,
        type: res.data.Type,
        year: res.data.Year,
        genre: res.data.Genre,
        writer: res.data.Writer,
        rated: res.data.Rated,
        language: res.data.Language,
        totalSeasons: res.data.totalSeasons,
        metascore: res.data.Metascore,
        imdbVotes: res.data.imdbVotes,
        ratings: res.data.Ratings
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function buildDuckDuckGoComponent(result, page, totalPages, bot, query, sessionId) {
  let domain, logoUrl;
  try {
    domain = new URL(result.url).hostname;
    logoUrl = await getLogoUrl(domain);
  } catch {
    domain = 'duckduckgo.com';
    logoUrl = 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/duckduckgo-icon.png';
  }

  function getShortTitle(title) {
    if (!title) return '';
    let t = title.split(' - ')[0].split(':')[0];
    if (t.length > 80) t = t.slice(0, 80) + '...';
    return t.trim();
  }

  if (result.isRelated && !result.isAbstract) {
  const ddgPrevId = `search_ddg_prev_${page - 1}_${sessionId}`;
  const ddgNextId = `search_ddg_next_${page + 1}_${sessionId}`;
    const expired = isPaginationExpired(sessionId);

    const textDisplays = [
      new TextDisplayBuilder().setContent(`# Related Topics`),
      result.title ? new TextDisplayBuilder().setContent(result.title) : undefined
    ].filter(Boolean);
    const section = new SectionBuilder()
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(logoUrl))
      .addTextDisplayComponents(...textDisplays);
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Prev')
        .setCustomId(ddgPrevId)
        .setDisabled(page === 1 || expired),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Next')
        .setCustomId(ddgNextId)
        .setDisabled(page === totalPages || expired),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Visit')
        .setURL(result.url || 'https://duckduckgo.com')
    );
    const container = new ContainerBuilder()
      .setAccentColor(0x18B035)
      .addSectionComponents(section)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# USF Bot - Page ${page} of ${totalPages}`)
      )
      .addActionRowComponents(actionRow);
    return container;
  }

  if (result.isAbstract && page === 1) {
  const ddgPrevId = `search_ddg_prev_${page - 1}_${sessionId}`;
  const ddgNextId = `search_ddg_next_${page + 1}_${sessionId}`;
    const expired = isPaginationExpired(sessionId);

    let width = result.ImageWidth, height = result.ImageHeight;
    let useThumbnail = false;
    if (result.image && result.image !== "") {
      if (typeof width !== 'number' || typeof height !== 'number') {
        width = null; height = null;
      }
      if (width && height && width <= height) {
        useThumbnail = true;
      } else if (width && height && width > height && width / height > 1.1) {
        useThumbnail = false;
      } else if (width && height && width === height) {
        useThumbnail = true;
      }
    }
    let markdown2 = `# ${result.title || query}\n`;
    if (result.url) markdown2 += `-# 🔗 [${domain}](${result.url})\n`;
    let markdown = '';
    let imdbId = null;
    let imdbRating = null;
    let imdbType = null;
    if (result.infobox && page === 1) {
      const infoboxContent = result.infobox.content || [];
      const embedFields = cleanInfoboxFields(infoboxContent);
      let wikidataDesc = null;
      for (const f of embedFields) {
        if (f.name === 'Wikidata description') {
          wikidataDesc = f.value;
          continue;
        }
        if (f.name === 'IMDb ID') {
          let rawImdbId = f.value;
          const match = /imdb\.com\/(title|name)\/(tt\d{7,8}|nm\d{7,8})/i.exec(f.value);
          if (match) rawImdbId = match[2];
          imdbId = rawImdbId;
          imdbType = (infoboxContent.find(x => x.label === 'Occupation') || {}).value || '';
          const imdbData = await fetchImdbRating(imdbId);
          if (imdbData && imdbData.title) {
            let imdbLink = /^tt\d{7,8}$/.test(imdbId)
              ? `https://www.imdb.com/title/${imdbId}/`
              : /^nm\d{7,8}$/.test(imdbId)
                ? `https://www.imdb.com/name/${imdbId}/`
                : `https://www.imdb.com/${imdbId}/`;
            let imdbLine = `**IMDb:** [IMDb](${imdbLink})`;
            if (imdbData.rating) imdbLine += ` (${imdbData.rating})`;
            markdown += imdbLine + '\n';
            if (["movie","series","episode"].includes(imdbData.type)) {
              const fields = [
                imdbData.year ? `**Year:** ${imdbData.year}` : null,
                imdbData.genre ? `**Genre:** ${imdbData.genre}` : null,
                imdbData.writer ? `**Writer:** ${imdbData.writer}` : null,
                imdbData.rated ? `**Rated:** ${imdbData.rated}` : null,
                imdbData.language ? `**Language:** ${imdbData.language}` : null,
                imdbData.totalSeasons ? `**Total Seasons:** ${imdbData.totalSeasons}` : null,
                imdbData.metascore && imdbData.metascore !== 'N/A' ? `**Metascore:** ${imdbData.metascore}` : null,
                imdbData.imdbVotes ? `**IMDb Votes:** ${imdbData.imdbVotes}` : null
              ].filter(Boolean);
              const bigFields = [];
              const smallFields = [];
              fields.forEach(f => {
                if (f.startsWith('**Writer:**') || f.startsWith('**Genre:**') || f.startsWith('**Language:**')) {
                  bigFields.push(f);
                } else {
                  smallFields.push(f);
                }
              });
              for (let i = 0; i < bigFields.length; i += 2) {
                markdown += bigFields.slice(i, i + 2).join(' | ') + '\n';
              }
              for (let i = 0; i < smallFields.length; i += 3) {
                markdown += smallFields.slice(i, i + 3).join(' | ') + '\n';
              }
              if (imdbData.ratings && Array.isArray(imdbData.ratings)) {
                imdbData.ratings.forEach(r => {
                  if (r.Source && r.Value) markdown += `**${r.Source}:** ${r.Value}\n`;
                });
              }
            }
          }
          continue;
        }
        markdown += `**${f.name}:** ${f.value}\n`;
      }
      if (wikidataDesc) {
        markdown += `\n-# ${wikidataDesc}\n`;
      }
    }
    if (result.description) markdown += `\n${result.description.slice(0, 2000)}\n`;

    let faviconDomain = result.OfficialDomain || null;
    if (!faviconDomain && result.infobox && Array.isArray(result.infobox.content)) {
      const officialWebsiteField = result.infobox.content.find(f => f.label === 'Official Website' && typeof f.value === 'string');
      if (officialWebsiteField) {
        try {
          faviconDomain = new URL(officialWebsiteField.value).hostname;
        } catch {}
      }
    }
    let faviconUrl = null;
    let validFavicon = false;
    if (faviconDomain) {
      try {
        faviconUrl = await getLogoUrl(faviconDomain);
        validFavicon = await isImageUrl(faviconUrl);
      } catch {}
    }
    const wikiLogo = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/100px-Wikipedia-logo-v2.svg.png';
    const thumbnailUrl = validFavicon ? faviconUrl : wikiLogo;

    const section = new SectionBuilder()
      .setThumbnailAccessory(
        useThumbnail && result.image
          ? new ThumbnailBuilder().setURL(result.image.startsWith('http') ? result.image : `https://duckduckgo.com${result.image}`)
          : new ThumbnailBuilder().setURL(thumbnailUrl)
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(markdown2));
    let mediaGallery = null;
    if (!useThumbnail && result.image && result.image !== "") {
      let width = result.ImageWidth, height = result.ImageHeight;
      if (typeof width !== 'number' || typeof height !== 'number') {
        width = null; height = null;
      }
      if (width && height && width > height && width / height > 1.1) {
        const imageUrl = result.image.startsWith('http') ? result.image : `https://duckduckgo.com${result.image}`;
        mediaGallery = new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(imageUrl)
        );
      }
    }
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Prev')
        .setCustomId(ddgPrevId)
        .setDisabled(page === 1 || expired),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Next')
        .setCustomId(ddgNextId)
        .setDisabled(page === totalPages || expired),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(`${result.url ? `Read More` : `Visit`}`)
        .setURL(result.url || 'https://duckduckgo.com')
    );
    const container = new ContainerBuilder()
      .setAccentColor(0x18B035)
      .addSectionComponents(section)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(markdown));
    if (mediaGallery) container.addMediaGalleryComponents(mediaGallery);
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# USF Bot - Page ${page} of ${totalPages}`)
    );
    container.addActionRowComponents(actionRow);
    return container;
  }

  if (!result.isAbstract && !result.infobox) {
  const ddgPrevId = `search_ddg_prev_${page - 1}_${sessionId}`;
  const ddgNextId = `search_ddg_next_${page + 1}_${sessionId}`;
    const expired = isPaginationExpired(sessionId);

    let shortTitle = getShortTitle(result.title);
    let content = '';
    content = result.description || result.title;
    if (shortTitle == result.title) {
      shortTitle = `${query}`;
    }
    const textDisplays = [
      new TextDisplayBuilder().setContent(`# ${shortTitle}`),
      content ? new TextDisplayBuilder().setContent(content) : undefined
    ].filter(Boolean);
    const section = new SectionBuilder()
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(logoUrl))
      .addTextDisplayComponents(...textDisplays);
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Prev')
        .setCustomId(ddgPrevId)
        .setDisabled(page === 1 || expired),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Next')
        .setCustomId(ddgNextId)
        .setDisabled(page === totalPages || expired),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Visit')
        .setURL(result.url || 'https://duckduckgo.com')
    );
    const container = new ContainerBuilder()
      .setAccentColor(0x18B035)
      .addSectionComponents(section)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# USF Bot - Page ${page} of ${totalPages}`)
      )
      .addActionRowComponents(actionRow);
    return container;
  }
}

async function buildSerpApiComponent(res, page, totalPages, engineName, color, emoji, query, logoUrl, domain, profanityDetected, sessionId) {
  const serpPrevId = `search_${engineName}_prev_${page - 1}_${sessionId}`;
  const serpNextId = `search_${engineName}_next_${page + 1}_${sessionId}`;
  const expired = isPaginationExpired(sessionId);

  let thumbnailUrl = logoUrl;
  if (res.pagemap) {
    if (res.pagemap.cse_image && Array.isArray(res.pagemap.cse_image) && res.pagemap.cse_image[0]?.src) {
      thumbnailUrl = res.pagemap.cse_image[0].src;
    } else if (res.pagemap.cse_thumbnail && Array.isArray(res.pagemap.cse_thumbnail) && res.pagemap.cse_thumbnail[0]?.src) {
      thumbnailUrl = res.pagemap.cse_thumbnail[0].src;
    } else if (res.pagemap.imageobject && Array.isArray(res.pagemap.imageobject) && res.pagemap.imageobject[0]?.url) {
      thumbnailUrl = res.pagemap.imageobject[0].url;
    }
  }
  const hasImage = thumbnailUrl && thumbnailUrl !== logoUrl;
  let extraInfo = '';
  if (res.pagemap) {
    if (res.pagemap.hcard && Array.isArray(res.pagemap.hcard) && res.pagemap.hcard[0]) {
      const h = res.pagemap.hcard[0];
      if (h.bday) extraInfo += `-# **Birthday:** ${h.bday}\n`;
      if (h.url_text) extraInfo += `-# **Website:** [${h.url_text}](https://${h.url_text.replace(/^(https?:\/\/)?/, '')})\n`;
    }
    if (res.pagemap.person && Array.isArray(res.pagemap.person) && res.pagemap.person[0]) {
      const p = res.pagemap.person[0];
      if (p.name) extraInfo += `-# **Person:** ${p.name}\n`;
      if (p.role) extraInfo += `-# **Role:** ${p.role}\n`;
    }
    if (res.pagemap.thing && Array.isArray(res.pagemap.thing) && res.pagemap.thing[0]) {
      const t = res.pagemap.thing[0];
      if (t.name) extraInfo += `-# **Thing:** ${t.name}\n`;
    }
    if (res.pagemap.hcard && Array.isArray(res.pagemap.hcard)) {
      for (const h of res.pagemap.hcard) {
        if (h.url && h.url.includes('twitter.com')) extraInfo += `-# [Twitter](${h.url}) `;
        if (h.url && h.url.includes('instagram.com')) extraInfo += `-# [Instagram](${h.url}) `;
        if (h.url && h.url.includes('facebook.com')) extraInfo += `-# [Facebook](${h.url}) `;
      }
    }
  }
  if (extraInfo) extraInfo = `\n${extraInfo.trim()}\n`;

  let markdown2 = `# ${emoji} ${res.title || query}\n`;
  markdown2 += `-# 🔗 [${domain}](${res.link})\n`;
  let markdown = '';
  if (extraInfo) markdown += `\n${extraInfo}`;
  markdown += `\n${res.snippet ? res.snippet.slice(0, 2000) : ''}`;

  const section = new SectionBuilder()
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(markdown2));

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Prev')
      .setCustomId(serpPrevId)
      .setDisabled(page === 1 || expired),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Next')
      .setCustomId(serpNextId)
      .setDisabled(page === totalPages || expired),
    ...(hasImage ? [
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Visit')
        .setURL(res.link)
    ] : [])
  );

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addSectionComponents(section)
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${markdown}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# USF Bot - Page ${page} of ${totalPages}`)
    )
    .addActionRowComponents(actionRow);

  if (!hasImage) {
    section.setButtonAccessory(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Visit')
        .setURL(res.link)
    );
  }

  return container;
}

async function filterQuery(query) {
  try {
    const response = await axios.get('https://www.purgomalum.com/service/json', {
      params: { text: query, fill_char: '-' }
    });
    return response.data.result || '[REDACTED]';
  } catch {
    return '[REDACTED]';
  }
}

async function handleDuckDuckGo(interaction, query, page = 1, profanityDetected = false, isPagination = false, sessionId = null) {
  const userId = interaction.user.id;
  const sid = sessionId || makeSessionId('ddg', query, userId);
  let results, totalPages;
  if (!isPagination) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&kp=1&safe=active`;
    const response = await axios.get(apiUrl);
    const data = response.data;
    results = parseDuckDuckGoResults(data, query).slice(0, 30);
    if (profanityDetected && results.length && results[0].isAbstract) {
      results = results.slice(1);
    }
    if (!results.length) {
      return interaction.editReply({ content: '<:search:1371166233788940460> No results found.' });
    }
  totalPages = results.length;
  setPaginationCache(sid, results, { query, totalPages }, userId);
  } else {
  const cache = getPaginationCache(sid);
    if (!cache) {
      await interaction.reply({ content: '❌ This search session has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      return;
    }
     if (interaction.user.id !== cache.userId) {
    return interaction.reply({ content: '❌ Only the user who ran the command can use these buttons.', flags: MessageFlags.Ephemeral });
  }
    results = cache.results;
    totalPages = cache.meta.totalPages;
    await interaction.deferUpdate();
  }
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const component = await buildDuckDuckGoComponent(results[currentPage - 1], currentPage, totalPages, interaction.client, query, sid);
  await interaction.editReply({ components: [component], flags: MessageFlags.IsComponentsV2 });
}

async function handleAllLinks(interaction, query, realQuery) {
  const encodedQuery = encodeURIComponent(query);
  const encodedRealQuery = encodeURIComponent(realQuery || query);
  const links = [
    { name: 'Google', url: `https://google.com/search?q=${encodedRealQuery}&safe=active`, emoji: '<:google:1266016555662184606>' },
    { name: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${encodedRealQuery}&kp=1`, emoji: '<:duckduckgo:1266021571508572261>' },
    { name: 'Bing', url: `https://bing.com/search?q=${encodedRealQuery}&adlt=strict`, emoji: '<:bing:1266020917314850907>' },
    { name: 'Yandex', url: `https://yandex.com/search/?text=${encodedQuery}&family=1`, emoji: '<:yandex:1266020634484539515>' },
    { name: 'Yahoo', url: `https://search.yahoo.com/search?p=${encodedQuery}`, emoji: '<:yahoo:1266019185100718155>' },
    { name: 'Brave', url: `https://search.brave.com/search?q=${encodedQuery}&safesearch=strict`, emoji: '<:brave:1266017410109149287>' },
    { name: 'Ecosia', url: `https://www.ecosia.org/search?q=${encodedQuery}&safesearch=1`, emoji: '<:ecosia:1266017707766055045>' },
    { name: 'Qwant', url: `https://www.qwant.com/?q=${encodedQuery}&safesearch=1`, emoji: '<:qwant:1266021495981998172>' },
    { name: 'Swisscows', url: `https://swisscows.com/it/web?query=${encodedQuery}&safesearch=true`, emoji: '<:swisscows:1266020983651958785>' },
    { name: 'Gibiru', url: `https://gibiru.com/results.html?q=${encodedQuery}`, emoji: '<:gibiru:1266020402749247581>' },
    { name: 'Lilo', url: `https://search.lilo.org/?q=${encodedQuery}&safe=active`, emoji: '<:lilo:1266019331301576754>' }
  ];
  const embed = new ContainerBuilder()
    .setAccentColor(0x00FFFF)
    .addSectionComponents(
      new SectionBuilder()
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(interaction.client.user.displayAvatarURL({ size: 2048 }))
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# Search Queries:"),
          new TextDisplayBuilder().setContent(links.map(l => `${l.emoji} [${query}](${l.url})`).join('\n'))
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# USF Bot')
    );
  await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
}

async function handleSerpApiEngine(interaction, query, engineName, color, emoji, page = 1, safeQuery = null, profanityDetected = false, isPagination = false, sessionId = null) {
  const userId = interaction.user.id;
  const sid = sessionId || makeSessionId(engineName, query, userId);
  let items, totalPages;
  if (!safeQuery) safeQuery = query;
  if (!isPagination) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    if (engineName === 'google') {
      try {
        const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&safe=active&num=10`;
        const response = await axios.get(apiUrl);
        items = (response.data.items || []).slice(0, 30);
        if (!items.length) {
          await interaction.editReply({ content: `<:search:1371166233788940460> No results found.` });
          return;
        }
  totalPages = items.length;
  setPaginationCache(sid, items, { query, totalPages }, userId);
      } catch (error) {
        let errMsg = error?.response?.data?.error?.message || error?.message || String(error);
        if (errMsg.includes('API key') || errMsg.includes('invalid') || errMsg.includes('quota')) {
          await interaction.editReply({ content: '❌ Google Search is currently unavailable. Please try another engine.' });
          return;
        }
        await interaction.editReply({ content: '❌ An error occurred while searching Google.' });
        return;
      }
    } else {
      if (!query || typeof query !== 'string' || !query.trim()) {
        await interaction.editReply({ content: '❌ No query provided.' });
        return;
      }
      try {
        let params;
        if (engineName === 'google') {
          params = { engine: engineName, q: query, num: 30, safe: 'active', api_key: process.env.SERPAPI_KEY || SERPAPI_KEY };
        } else if (engineName === 'bing') {
          params = { engine: engineName, q: query, num: 30, safeSearch: 'strict', api_key: process.env.SERPAPI_KEY || SERPAPI_KEY };
        } else if (engineName === 'yahoo') {
          params = { engine: engineName, p: query, num: 30, vm: 'r', api_key: process.env.SERPAPI_KEY || SERPAPI_KEY };
        } else if (engineName === 'yandex') { //DISABLED!!!!
          params = { engine: engineName, text: query, num: 30, safe: 'active', api_key: process.env.SERPAPI_KEY || SERPAPI_KEY };
        } else {
          params = { engine: engineName, text: query, num: 30, safe: 'active', api_key: process.env.SERPAPI_KEY || SERPAPI_KEY };
        }
        let serpApiError = null;
        await new Promise((resolve) => {
          getJson(params, async (result, err) => {
            if (err || (result && result.error && typeof result.error === 'string' && result.error.match(/api key|invalid|quota|unavailable|forbidden|denied|Missing query/i))) {
              serpApiError = result && result.error ? result.error : (err && err.message ? err.message : 'Unknown error');
              return resolve();
            }
            items = (result && result.organic_results && Array.isArray(result.organic_results)) ? result.organic_results.slice(0, 30) : [];
            if (!items.length) {
              await interaction.editReply({ content: `<:search:1371166233788940460> No results found.` });
              return resolve();
            }
            totalPages = items.length;
            setPaginationCache(sid, items, { query, totalPages }, userId);
            resolve();
          });
        });
        if (serpApiError) {
          await interaction.editReply({ content: `❌ ${engineName.charAt(0).toUpperCase() + engineName.slice(1)} Search is currently unavailable. ${serpApiError}` });
          return;
        }
      } catch (err) {
        await interaction.editReply({ content: `❌ ${engineName.charAt(0).toUpperCase() + engineName.slice(1)} Search is currently unavailable. Please try another engine.` });
        return;
      }
    }
  } else {
  const cache = getPaginationCache(sid);
    if (!cache) {
      await interaction.reply({ content: '❌ This pagination session has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      return;
    }
     if (interaction.user.id !== cache.userId) {
    return interaction.reply({ content: '❌ Only the user who ran the command can use these buttons.', flags: MessageFlags.Ephemeral });
  }
    items = cache.results;
    totalPages = cache.meta.totalPages;
    await interaction.deferUpdate();
  }
  const currentPage = Math.max(1, Math.min(page, totalPages));
  let res, domain, logoUrl;
  if (engineName === 'google') {
    res = items[currentPage - 1];
    try {
      domain = new URL(res.link).hostname;
      logoUrl = await getLogoUrl(domain);
    } catch {
      domain = 'google.com';
      logoUrl = '';
    }
  const component = await buildSerpApiComponent(res, currentPage, totalPages, engineName, color, emoji, query, logoUrl, domain, profanityDetected, sid);
    await interaction.editReply({ components: [component], flags: MessageFlags.IsComponentsV2 });
    return;
  } else {
    res = items[currentPage - 1];
    try {
      domain = new URL(res.link).hostname;
      logoUrl = await getLogoUrl(domain);
    } catch {
      domain = engineName + '.com';
      logoUrl = null;
    }
    if (!logoUrl) logoUrl = '';
  const component = await buildSerpApiComponent(res, currentPage, totalPages, engineName, color, emoji, query, logoUrl, domain, profanityDetected, sid);
    await interaction.editReply({ components: [component], flags: MessageFlags.IsComponentsV2 });
    return;
  }
}

async function handlePagination(interaction) {
  const id = interaction.customId;
  const ddgMatch = id.match(/^search_ddg_(prev|next)_(\d+)_(.+)$/);
  const serpMatch = id.match(/^search_(google|bing|yahoo|yandex)_(prev|next)_(\d+)_(.+)$/);
  let sessionId, page;
  if (ddgMatch) {
    const [, , pageStr, sessionIdRaw] = ddgMatch;
    sessionId = sessionIdRaw;
    page = Math.max(1, parseInt(pageStr, 10));
    if (isPaginationExpired(sessionId)) {
      await interaction.reply({ content: '❌ This pagination session has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      return;
    }
    const cache = getPaginationCache(sessionId);
    if (!cache) {
      await interaction.reply({ content: '❌ This pagination session has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      return;
    }
     if (interaction.user.id !== cache.userId) {
    return interaction.reply({ content: '❌ Only the user who ran the command can use these buttons.', flags: MessageFlags.Ephemeral });
  }
    const safeQuery = cache.meta.query;
    const profanityDetected = false; //ALREADY FILTERED !!
  await handleDuckDuckGo(interaction, safeQuery, page, profanityDetected, true, sessionId);
    return;
  } else if (serpMatch) {
    const [ , engine, , pageStr, sessionIdRaw ] = serpMatch;
    sessionId = sessionIdRaw;
    page = Math.max(1, parseInt(pageStr, 10));
    if (isPaginationExpired(sessionId)) {
      await interaction.reply({ content: '❌ This pagination session has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      return;
    }
    const cache = getPaginationCache(sessionId);
    if (!cache) {
      await interaction.reply({ content: '❌ This pagination session has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      return;
    }
     if (interaction.user.id !== cache.userId) {
    return interaction.reply({ content: '❌ Only the user who ran the command can use these buttons.', flags: MessageFlags.Ephemeral });
  }
    const safeQuery = cache.meta.query;
    const profanityDetected = false;
    await handleSerpApiEngine(interaction, safeQuery, engine, 
      engine === 'google' ? 0x4285F4 : engine === 'bing' ? 0x00809D : engine === 'yahoo' ? 0x720E9E : 0xFF0000,
      engine === 'google' ? '<:google:1266016555662184606>' : engine === 'bing' ? '<:bing:1266020917314850907>' : engine === 'yahoo' ? '<:yahoo:1266019185100718155>' : '<:yandex:1266020634484539515>',
      page, safeQuery, profanityDetected, true, sessionId
    );
    return;
  }
}
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search the web')
    .addSubcommand(sub => sub.setName('duckduckgo').setDescription('Search DuckDuckGo').addStringOption(opt => opt.setName('query').setDescription('Query').setRequired(true)))
    .addSubcommand(sub => sub.setName('google').setDescription('Search Google').addStringOption(opt => opt.setName('query').setDescription('Query').setRequired(true)))
    .addSubcommand(sub => sub.setName('bing').setDescription('Search Bing').addStringOption(opt => opt.setName('query').setDescription('Query').setRequired(true)))
    .addSubcommand(sub => sub.setName('yahoo').setDescription('Search Yahoo').addStringOption(opt => opt.setName('query').setDescription('Query').setRequired(true)))
    //.addSubcommand(sub => sub.setName('yandex').setDescription('Search Yandex').addStringOption(opt => opt.setName('query').setDescription('Query').setRequired(true)))
    .addSubcommand(sub => sub.setName('queries').setDescription('Get links to all search engines').addStringOption(opt => opt.setName('query').setDescription('Query').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const query = interaction.options.getString('query');
    if (sub === 'queries') {
      const safeQueryImmediate = await filterQuery(query);
      await handleAllLinks(interaction, safeQueryImmediate, query);
      return;
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    const safeQuery = await filterQuery(query);
    const profanityDetected = safeQuery !== query;
    if (sub === 'duckduckgo') {
      await handleDuckDuckGo(interaction, safeQuery, 1, profanityDetected);
    } else if (sub === 'google') {
      await handleSerpApiEngine(interaction, safeQuery, 'google', 0x4285F4, '<:google:1266016555662184606>', 1, safeQuery, profanityDetected);
    } else if (sub === 'bing') {
      await handleSerpApiEngine(interaction, safeQuery, 'bing', 0x00809D, '<:bing:1266020917314850907>', 1, safeQuery, profanityDetected);
    } else if (sub === 'yahoo') {
      await handleSerpApiEngine(interaction, safeQuery, 'yahoo', 0x720E9E, '<:yahoo:1266019185100718155>', 1, safeQuery, profanityDetected);
    } else if (sub === 'yandex') {
      await handleSerpApiEngine(interaction, safeQuery, 'yandex', 0xFF0000, '<:yandex:1266020634484539515>', 1, safeQuery, profanityDetected);
    } else {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('<:search:1371166233788940460> Engine not implemented yet.');
      } else {
        await interaction.reply('<:search:1371166233788940460> Engine not implemented yet.');
      }
    }
  },
  handlePagination,
  filterQuery
};