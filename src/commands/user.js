const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, MessageFlags, Routes } = require('discord.js');

const FLAG_MASKS = {
    1:        '<:discordstaff:1366056643250360422>',
    2:        '<:partner:1366056740696625203>',
    4:        '<:hypesquad:1366056683964727396>',
    6:        '<:quests:1366056754869309440>',
    8:        '<:bughunter:1366056629988233266>',
    64:       '<:bravery:1366056599738912798>',
    128:      '<:brillance:1366056614473367672>',
    256:      '<:balance:1366056570240106638>',
    512:      '<:earlysupporter:1366056657389621289>',
    1024:     '👥',
    4096:     '<:discord:1367852983232106677>',
    16384:    '<:goldenbughunter:1366056671088218183>',
    65536:    'VERIFIED_BOT',
    131072:   '<:early_verified_bot_dev:1366056725534343309>',
    262144:   '<:moderator:1366056698732613682>',
    1048576:  '🚫',
    4194304:  '<:activedev:1366056552909377546>',
};

const BOOSTER_EMOJI = '<:booster:1366056584714653907>';

function translateFlags(flagsInt) {
    const badges = [];
    for (const [mask, emoji] of Object.entries(FLAG_MASKS)) {
      if (flagsInt & Number(mask)) badges.push(emoji);
    }
    return badges.length ? badges.join(' ') : 'None';
}
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Get information about a user')
    .addUserOption(opt => opt.setName('target').setDescription('User to view'))
    .setDMPermission(true),
  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('target') || interaction.user;
    const user = await interaction.client.rest
    .get(Routes.user(target.id))
    .catch(() => null);
    if (!user) return interaction.editReply({ content: 'User not found', flags: MessageFlags.Ephemeral });

    const flags = user.public_flags !== null ? user.public_flags : user.flags;
    let badges = translateFlags(flags);
    if (badges === 'None') badges = '';
    
    let badgeArray = badges !== 'None' ? badges.split(' ') : [];
    let titleSuffix = ' Information';

    let isBoosting = false;
    let member;
    if (interaction.guild) {
      member = interaction.options.getMember('target') || interaction.member;
      if (member && (member.premiumSince || member.premium_since_timestamp)) {
        isBoosting = true;
      }
    }

    if (target.bot) {
      let verified = false;
      let newBadgeArray = [];
      for (const badge of badgeArray) {
         if (badge == 'VERIFIED_BOT') {
           verified = true;
         } else {
           newBadgeArray.push(badge);
         }
      }
      titleSuffix = verified ? ' <:verifiedapp:1367852951250665552>' : ' <:app:1367852968090665082>';
      badgeArray = newBadgeArray;
    }

    let title = `${target.username}${isBoosting ? ` ${BOOSTER_EMOJI}` : `${titleSuffix}`}`;
    
    let usernameDisplay = target.username;
    if (target.discriminator && target.discriminator !== '0') {
      usernameDisplay += `#${target.discriminator}`;
    }

    const embed = new EmbedBuilder()
      .setColor(target.hexAccentColor || 0x5865F2)
      .setTitle(title)
      .setThumbnail(target.displayAvatarURL({ size: 2048 }));

    const fields = [
      { name: 'Username & ID', value: `${usernameDisplay} | ${target.id}` },
      { name: '\u200B', value: '\u200B' },
      { name: 'Created Date', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:F>` }
    ];

    let clanName, clanTag;
    if (user.clan) {
      clanName = user.clan.name;
      clanTag = user.clan.tag;
    } else if (interaction.guild && member) {
      if (member.clan) {
        clanName = member.clan.name;
        clanTag = member.clan.tag;
      }
    }
    if (clanName || clanTag) {
      fields.push({
        name: 'Clan',
        value: `${clanTag ? ` \`[${clanTag}]\`` : ''}`
      });
    }
    if (badgeArray.length && badgeArray.some(b => b.trim() !== '')) {
      fields.push({ name: 'Badges', value: badgeArray.join(' ') });
    }
    
    if (interaction.guild && member) {
      fields.push({ name: 'Joined Date', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` });
    }

    embed.addFields(fields)
         .setTimestamp()
         .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ size: 2048 }) });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Avatar Link')
          .setStyle(ButtonStyle.Link)
          .setURL(target.displayAvatarURL({ size: 2048 }))
      );

    if (user.banner) {
      const bannerURL = `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${user.banner.startsWith('a_') ? 'gif' : 'png'}?size=2048`;
      embed.setImage(bannerURL);
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Banner Link')
          .setStyle(ButtonStyle.Link)
          .setURL(bannerURL)
      );
    }

    return interaction.editReply({ embeds: [embed], components: [row] });
  }
};
