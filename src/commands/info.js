const { SlashCommandBuilder, ContainerBuilder, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js')
const { discord, terms, github, website, privacy, status, botinvite, image, version } = require('../../config.json')
var ms = require('ms')
//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Get information about the bot'),
    async execute(interaction) {
        await interaction.deferReply()
        let uptime = ms(interaction.client.uptime)
        let totalUsers = interaction.client.users.cache.size.toLocaleString()

        const info = new ContainerBuilder()
            .setAccentColor(0x0000ff)
            .addSectionComponents(component => component.addTextDisplayComponents(components =>
                components.setId(10).setContent('# USF Bot by DXS International \n\n– Your All-in-One Discord Multipurpose Bot! 🚀  \n\nDesigned to supercharge servers with **next-level moderation tools**, **time-saving utilities**, and **hilarious entertainment features**, USF Bot is here to transform your community experience. Whether you’re managing roles, hosting events, or just vibe-checking with memes, this bot’s got your back.  \n\n✨ **Why USF Bot?**  \n✅ **Powerful Moderation**: Streamline server management with automated warnings, role assignments, and more.  \n✅ **Smart Utilities**: Quick polls, custom commands, and server analytics – done faster.  \n✅ **Fun & Games**: Mini-games, randomizers, and meme magic to keep the chat lit.  \n✅ **100% Free**: No hidden costs, no premium walls. Built by our team, with the help of the community.  \n\nEvery feature is shaped by **user feedback** from servers like yours. Ready to level up?  \n\n*Crafted with 💻 by DXS International*'))
                .setThumbnailAccessory(components => components.setId(11).setURL(image)))
            .addSeparatorComponents(component => component.setId(2).setDivider(true))
            .addTextDisplayComponents(component => component.setId(3).setContent(
                `- **Version:** \`${version}\`\n- **Uptime:** \`${uptime}\`\n- **Total Users:** \`${totalUsers}\`\n\n## Useful Links`
            ))
            .addActionRowComponents(
                component => component.setId(4).addComponents(
                    new ButtonBuilder()
                        .setLabel('Discord Server')
                        .setURL(discord)
                        .setEmoji('<:discord:1367852983232106677>')
                        .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                        .setLabel('Invite')
                        .setURL(`${botinvite}`)
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🔗'),
                    new ButtonBuilder()
                        .setEmoji('<:github:1389001205245542420>')
                        .setLabel('GitHub Repository')
                        .setURL(github)
                        .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                        .setEmoji('🌐')
                        .setLabel('Website')
                        .setURL(website)
                        .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                        .setEmoji('💔')
                        .setLabel('Status Page')
                        .setURL(status)
                        .setStyle(ButtonStyle.Link)
                )
            )
            .addSeparatorComponents(component => component.setId(5).setDivider(true))
            .addTextDisplayComponents(component => component.setId(6).setContent('## Legal Section'))
            .addActionRowComponents(component => component.setId(7).setComponents(
                new ButtonBuilder()
                    .setLabel('Terms of Service')
                    .setURL(`${terms}`)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🛡'),
                new ButtonBuilder()
                    .setLabel('Privacy Policy')
                    .setURL(`${privacy}`)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🔒')
            ));
           //.addTextDisplayComponents(component => component.setId(8).setContent(`-# ${randomFact}`));


        interaction.editReply({ components: [info], flags: MessageFlags.IsComponentsV2 });
    }
}

// NOT BEING USED, POPULATE WITH MORE FACTS AND ENABLE BY UNNCOMMENTING LINE 66 AND REMOVING THE ; from line 65
const funFacts = [
    "💡 Fun Fact: The bot was written entirely in Node.js!",
    "💡 Fun Fact: This command has 82 lines of code!",
    "💡 Fun Fact: This cat --> 🐱 likes /search duckduckgo more than /search google!",
    "💡 Fun Fact: The development team is bald..",
    "💡 Fun Fact: /gemini can generate images!"
];

const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
