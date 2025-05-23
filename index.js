// Import required libraries
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const noblox = require("noblox.js");

// Set up bot token and Roblox credentials
const DISCORD_TOKEN = process.env["DISCORD_TOKEN"]; // Replace with your Discord bot token
const ROBLOX_GROUP_ID = process.env["ROBLOX_GROUP_ID"]; // Replace with your Roblox group ID
const ROBLOX_COOKIE = process.env["ROBLOX_COOKIE"]; // Replace with your Roblox session cookie (ROBLOSECURITY)
const LOG_CHANNEL_ID = process.env["LOG_CHANNEL_ID"];

// Create a new Discord client (updated for discord.js v14+)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required for reading message content in v14+
  ],
});

// Roblox login
async function robloxLogin() {
  try {
    const currentUser = await noblox.setCookie(ROBLOX_COOKIE);
    console.log(`Logged in to Roblox as ${currentUser.UserName}`);
  } catch (error) {
    console.error("Failed to login to Roblox:", error);
  }
}

// Helper to log commands to the specified channel
async function logCommand(message, commandName, targetUser, rankName) {
  try {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const executor = `${message.author} (${message.author.tag})`;
    const target = targetUser || "N/A";
    const rank = rankName || "N/A";

    const logEmbed = {
      color: 0x00ff00,
      title: commandName.replace('!', '').toUpperCase(),
      fields: [
        { name: 'Executed by', value: executor, inline: true },
        { name: 'Target User', value: target, inline: true },
        { name: 'Rank', value: rank, inline: true }
      ],
      timestamp: new Date()
    };

    logChannel.send({ embeds: [logEmbed] });
  } catch (err) {
    console.error("Failed to send log message:", err);
  }
}

// Check for ranking permission before handling commands
function hasRankingPermission(message) {
  const allowedRoleName = 'Ranking Permission'; // Replace with your role name
  return message.member && message.member.roles.cache.some(role => role.name === allowedRoleName);
}

// Promote command: promote user 1 rank up
async function promoteUser(message, robloxUsername) {
  try {
    const userId = await noblox.getIdFromUsername(robloxUsername);
    if (!userId) {
      message.channel.send('Could not find Roblox user \${robloxUsername}\.');
      return;
    }

    const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
    const currentRank = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userId);

    // Find the current rank role object
    const currentRoleIndex = roles.findIndex((r) => r.rank === currentRank);
    if (currentRoleIndex === -1) {
      message.channel.send(
        Could not find current rank for user \${robloxUsername}\.,
      );
      return;
    }

    // Check if user is already at highest rank
    if (currentRoleIndex === roles.length - 1) {
      message.channel.send(
        ${robloxUsername} is already at the highest rank (${roles[currentRoleIndex].name}).,
      );
      return;
    }

    const newRank = roles[currentRoleIndex + 1];

    await noblox.setRank(ROBLOX_GROUP_ID, userId, newRank.rank);
    message.channel.send(
      Successfully promoted ${robloxUsername} to **${newRank.name}**.,
    );

    // Log command usage
    await logCommand(message, "!promote", robloxUsername, newRank.name);
  } catch (error) {
    console.error(error);
    message.channel.send("An error occurred while trying to promote the user.");
  }
}

// Demote command: demote user 1 rank down
async function demoteUser(message, robloxUsername) {
  try {
    const userId = await noblox.getIdFromUsername(robloxUsername);
    if (!userId) {
      message.channel.send(Could not find Roblox user \${robloxUsername}\.);
      return;
    }

    const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
    const currentRank = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userId);

    const currentRoleIndex = roles.findIndex((r) => r.rank === currentRank);
    if (currentRoleIndex === -1) {
      message.channel.send(
        Could not find current rank for user \${robloxUsername}\.,
      );
      return;
    }

    // Check if user is already at lowest rank
    if (currentRoleIndex === 0) {
      message.channel.send(
        ${robloxUsername} is already at the lowest rank (${roles[currentRoleIndex].name}).,
      );
      return;
    }

    const newRank = roles[currentRoleIndex - 1];

    await noblox.setRank(ROBLOX_GROUP_ID, userId, newRank.rank);
    message.channel.send(
      Successfully demoted ${robloxUsername} to **${newRank.name}**.,
    );

    // Log command usage
    await logCommand(message, "!demote", robloxUsername, newRank.name);
  } catch (error) {
    console.error(error);
    message.channel.send("An error occurred while trying to demote the user.");
  }
}

client.once("ready", async () => {
  console.log(${client.user.tag} is online!);
  await robloxLogin();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Check for Ranking Permission role or Admin perms
  if (!hasRankingPermission(message) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    if (message.content.startsWith('!promote') || message.content.startsWith('!demote') || 
        message.content.startsWith('!setrank') || message.content.startsWith('!ranklist')) {
      return message.reply("You need the 'Ranking Permission' role to use ranking commands.");
    }
    return;
  }

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === "!promote") {
    if (args.length !== 1) {
      message.channel.send("Usage: !promote <roblox username>");
      return;
    }
    const robloxUsername = args[0];
    await promoteUser(message, robloxUsername);
  }

  if (command === "!demote") {
    if (args.length !== 1) {
      message.channel.send("Usage: !demote <roblox username>");
      return;
    }
    const robloxUsername = args[0];
    await demoteUser(message, robloxUsername);
  }

  if (message.content.toLowerCase().startsWith("!ranklist")) {
    try {
      const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
      const ranksPerPage = 10;
      const totalPages = Math.ceil(roles.length / ranksPerPage);
      let currentPage = 1;

      function getRankListPage(page) {
        const start = (page - 1) * ranksPerPage;
        const end = start + ranksPerPage;
        const pageRoles = roles.slice(start, end);
        return pageRoles.map(role => ${role.name}: ${role.rank}).join('\n');
      }

      function getRankListPage(page) {
        const filteredRoles = roles.filter(role => role.rank !== 0);
        const start = (page - 1) * ranksPerPage;
        const end = start + ranksPerPage;
        const pageRoles = filteredRoles.slice(start, end);
        return pageRoles.map(role => \${role.rank}\ • **${role.name}**).join('\n');
      }

      const rankEmbed = {
        color: 0x2F3136,
        title: '📋 Group Rank List',
        description: Below are all available ranks in the group. Use the buttons to navigate between pages.\n\n**Page ${currentPage} of ${totalPages}**\n\n${getRankListPage(currentPage)},
        footer: { 
          text: Total Ranks: ${roles.length} • Page ${currentPage}/${totalPages},
          icon_url: message.guild.iconURL()
        },
        timestamp: new Date()
      };

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 1),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages)
        );

      const msg = await message.channel.send({ embeds: [rankEmbed], components: [row] });

      const collector = msg.createMessageComponentCollector({ 
        filter: i => i.user.id === message.author.id,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.customId === 'previous' && currentPage > 1) {
          currentPage--;
        } else if (i.customId === 'next' && currentPage < totalPages) {
          currentPage++;
        }

        rankEmbed.description = Available ranks and their IDs (Page ${currentPage}/${totalPages}):\n\n${getRankListPage(currentPage)};

        row.components[0].setDisabled(currentPage === 1);
        row.components[1].setDisabled(currentPage === totalPages);

        await i.update({ embeds: [rankEmbed], components: [row] });
      });

      collector.on('end', () => {
        row.components.forEach(button => button.setDisabled(true));
        msg.edit({ components: [row] }).catch(error => console.error('Failed to disable buttons:', error));
      });
    } catch (error) {
      console.error("Error fetching rank list:", error);
      message.channel.send("Failed to fetch the rank list. Please try again later.");
    }
  }

  if (message.content.toLowerCase().startsWith("!setrank")) {
    const args = message.content.split(" ");
    const robloxUsername = args[1];
    const rankId = parseInt(args[2]);

    if (!robloxUsername || isNaN(rankId)) {
      return message.channel.send(
        "Please provide a valid Roblox username and rank ID. Usage: !setrank <username> <rankID>",
      );
    }

    try {
      const userId = await noblox.getIdFromUsername(robloxUsername);
      if (!userId) {
        return message.channel.send(
          Could not find user ${robloxUsername} on Roblox.,
        );
      }

      // Set the rank
      await noblox.setRank(ROBLOX_GROUP_ID, userId, rankId);

      // Get the rank name to show in the message
      const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
      const role = roles.find((r) => r.rank === rankId);
      const rankName = role ? role.name : "Unknown Rank";

      message.channel.send(
        Successfully set ${robloxUsername}'s rank to **${rankName}**.,
      );

      // Log the command usage
      await logCommand(message, "!setrank", robloxUsername, ${rankName} (ID: ${rankId}));
    } catch (error) {
      console.error("Error in !setrank command:", error);
      message.channel.send(
        "There was an error setting the rank. Please try again later.",
      );
    }
  }

  if (message.content.toLowerCase() === "!rankhelp") {
    const helpEmbed = {
      color: 0x0099ff,
      title: 'Rank Bot Commands',
      description: 'Here are all available commands:',
      fields: [
        { name: '!promote <roblox username>', value: 'Promotes a user up one rank' },
        { name: '!demote <roblox username>', value: 'Demotes a user one rank below' },
        { name: '!setrank <roblox username> <rank ID>', value: 'Sets rank of the user to that of the rank ID' },
        { name: '!ranklist', value: 'Shows all of the rank IDs, used for !setrank command' },
        { name: '!exile <roblox username>', value: 'Exiles a user from the group (Admin only)' }
      ],
      timestamp: new Date()
    };

    message.channel.send({ embeds: [helpEmbed] });
  }
  if (message.content.toLowerCase().startsWith("!exile")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Only administrators can use the exile command.");
    }

    const args = message.content.split(" ");
    const robloxUsername = args[1];

    if (!robloxUsername) {
      return message.channel.send("Please provide a Roblox username. Usage: !exile <username>");
    }

    try {
      const userId = await noblox.getIdFromUsername(robloxUsername);
      if (!userId) {
        return message.channel.send(Could not find user ${robloxUsername} on Roblox.);
      }

      await noblox.exile(ROBLOX_GROUP_ID, userId);
      message.channel.send(Successfully exiled ${robloxUsername} from the group.);

      // Log the command usage
      await logCommand(message, "!exile", robloxUsername, "Exiled from group");
    } catch (error) {
      console.error("Error in !exile command:", error);
      message.channel.send("There was an error exiling the user.");
    }
  }
  // Other commands go here
const authorizedUserID = '123456789012345678';

module.exports = {
    name: 'maintenance',
    description: 'Put the bot into maintenance mode (authorized users only)',
    async execute(message) {
        // Check if the message author is the authorized user
        if (message.author.id !== authorizedUserID) {
            return message.reply("You don't have permission to use this command.");
        }

        // Create the maintenance embed
        const maintenanceEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('**Maintenance Mode Activated**')
            .setDescription('The bot is currently undergoing maintenance.\nPlease stand by — we\'ll be back shortly!')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/189/189792.png')
            .addFields(
                { name: 'Status', value: 'Under Maintenance', inline: true },
                { name: 'ETA', value: 'Soon', inline: true }
            )
            .setFooter({ text: 'Thank you for your patience!', iconURL: message.client.user.displayAvatarURL() })
            .setTimestamp();

        // Send the embed to the channel
        message.channel.send({ embeds: [maintenanceEmbed] });
    }
};

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(./commands/${file});
    client.commands.set(command.name, command);
}

client.on('messageCreate', async message => {
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('There was an error trying to execute that command.');
    }
});
    if (message.content === '!maintenance') {
        if (message.author.id !== '942051843306049576') {
            return message.reply("You don't have permission to use this command.");
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('**Maintenance Mode Activated**')
            .setDescription('The bot is currently undergoing maintenance.\nPlease stand by — we\'ll be back shortly!')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/189/189792.png')
            .addFields(
                { name: 'Status', value: 'Under Maintenance', inline: true },
                { name: 'ETA', value: 'Soon', inline: true }
            )
            .setFooter({ text: 'Thank you for your patience!', iconURL: message.client.user.displayAvatarURL() })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});