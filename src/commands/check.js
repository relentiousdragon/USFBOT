const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const tcpPing = require('tcp-ping');
const dns = require('dns').promises;

function isValidIPAddress(ip) {
  const ipv4Regex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/;
  const ipv6Regex = /^((?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|::1|::$)$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

function isValidDomain(domain) {
  const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}
//
module.exports = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Ping an IP/Domain/URL/Host')
    .addStringOption(option =>
      option.setName('target')
        .setDescription('Enter an IP address, domain, URL, or host to ping')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const input = interaction.options.getString('target').trim();
    let host = input;
    let port = 80;

    if (input.startsWith('http://') || input.startsWith('https://')) {
      try {
        const urlObj = new URL(input);
        host = urlObj.hostname;
        if (urlObj.port) {
          port = parseInt(urlObj.port, 10);
        }
      } catch (error) {
        const invalidUrlEmbed = new EmbedBuilder()
          .setTitle('Invalid URL')
          .setDescription(`\`${input}\` is not a valid URL.`)
          .setColor(0xFF0000)
          .setTimestamp();
        return await interaction.editReply({ embeds: [invalidUrlEmbed] });
      }
    } else {
      if (input.includes(':')) {
        const parts = input.split(':');
        host = parts[0];
        if (parts[1] && !isNaN(parts[1])) {
          port = parseInt(parts[1], 10);
        }
      }
      if (!isValidIPAddress(host) && !isValidDomain(host) && host.toLowerCase() !== 'localhost') {
        const invalidEmbed = new EmbedBuilder()
          .setTitle('Invalid Target')
          .setDescription(`\`${host}\` is not a valid IP, domain, URL, or host.`)
          .setColor(0xFF0000)
          .setTimestamp();
        return await interaction.editReply({ embeds: [invalidEmbed] });
      }
    }

    let resolvedIP = null;
    if (!isValidIPAddress(host)) {
      try {
        const addresses = await dns.lookup(host, { all: true });
        if (addresses && addresses.length > 0) {
          resolvedIP = addresses[0].address;
        }
      } catch (error) {
        console.error('DNS Lookup error:', error);
      }
    }

    const options = {
      address: host,
      port: port,
      attempts: 3,
      timeout: 2000,
      interval: 1000,
    };

    tcpPing.probe(host, port, async (err, available) => {
      if (err) {
        console.error('Probe error:', err);
        const errorEmbed = new EmbedBuilder()
          .setTitle('Ping Error')
          .setDescription(`An error occurred while probing **${host}**:\n\`${err.message}\``)
          .setColor(0xFF0000)
          .setTimestamp();
        return await interaction.editReply({ embeds: [errorEmbed] });
      }

      if (!available) {
        const offlineEmbed = new EmbedBuilder()
          .setTitle(`Ping Results for ${host}`)
          .setDescription('🔴 Offline\n-# Please note that ICMP ping may require elevated privileges or may be blocked by some hosts/firewalls.')
          .setColor(0xFF0000)
          .setTimestamp()
          .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ size: 2048 }) });
        const offlineFields = [];
        offlineFields.push({ name: 'Port', value: port.toString(), inline: true });
        if (!isValidIPAddress(input) && resolvedIP) {
          offlineFields.push({ name: 'Resolved IP', value: resolvedIP, inline: true });
        }
        offlineEmbed.addFields(...offlineFields);
        return await interaction.editReply({ embeds: [offlineEmbed] });
      }

      tcpPing.ping(options, async (err, data) => {
        if (err) {
          console.error('Ping error:', err);
          const errorEmbed = new EmbedBuilder()
            .setTitle('Ping Error')
            .setDescription(`An error occurred while pinging **${host}**:\n\`${err.message}\``)
            .setColor(0xFF0000)
            .setTimestamp();
          return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const fields = [];
        fields.push({ name: 'Port', value: port.toString(), inline: true });
        if (!isValidIPAddress(input) && resolvedIP) {
          fields.push({ name: 'Resolved IP', value: resolvedIP, inline: true });
        }
        fields.push(
          { name: 'Attempts', value: (data.attempts != null) ? data.attempts.toString() : 'Unknown', inline: true },
          { name: 'Min', value: (data.min != null) ? `${data.min.toFixed(2)} ms` : 'Unknown', inline: true },
          { name: 'Max', value: (data.max != null) ? `${data.max.toFixed(2)} ms` : 'Unknown', inline: true },
          { name: 'Avg', value: (data.avg != null && !isNaN(data.avg)) ? `${data.avg.toFixed(2)} ms` : 'Unknown', inline: true }
        );
        if (data.stddev != null && !isNaN(data.stddev)) {
          fields.push({ name: 'Std Dev', value: `${data.stddev.toFixed(2)} ms`, inline: true });
        }

        const pingEmbed = new EmbedBuilder()
          .setTitle(`Ping Results for ${host}`)
          .setColor(0x1d4ed8)
          .addFields(...fields)
          .setTimestamp()
          .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ size: 2048 }) });
        
        return await interaction.editReply({ embeds: [pingEmbed] });
      });
    });
  }
};
