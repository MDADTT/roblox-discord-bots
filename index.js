// Import required libraries
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const noblox = require("noblox.js");

// Set up bot token and Roblox credentials
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let isMaintenanceMode = false;

// Roblox login
async function robloxLogin() {
  try {
    const currentUser = await noblox.setCookie(ROBLOX_COOKIE);
    console.log(`Logged in to Roblox as ${currentUser.UserName}`);
  } catch (error) {
    console.error("Failed to login to Roblox:", error);
  }
}

// Helper to log commands
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

// Check for ranking permission
function hasRankingPermission(message) {
  const allowedRoleName = 'Ranking Permission';
  return message.member && message.member.roles.cache.some(role => role.name === allowedRoleName);
}

// Promote command
async function promoteUser(message, robloxUsername) {
  try {
    const userId = await noblox.getIdFromUsername(robloxUsername);
    if (!userId) {
      message.channel.send(`Could not find Roblox user ${robloxUsername}`);
      return;
    }

    const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
    const currentRank = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userId);

    const currentRoleIndex = roles.findIndex((r) => r.rank === currentRank);
    if (currentRoleIndex === -1) {
      message.channel.send(`Could not find current rank for user ${robloxUsername}`);
      return;
    }

    if (currentRoleIndex === roles.length - 1) {
      message.channel.send(
        `${robloxUsername} is already at the highest rank (${roles[currentRoleIndex].name})`
      );
      return;
    }

    const newRank = roles[currentRoleIndex + 1];

    await noblox.setRank(ROBLOX_GROUP_ID, userId, newRank.rank);
    message.channel.send(
      `Successfully promoted ${robloxUsername} to **${newRank.name}**`
    );

    await logCommand(message, "!promote", robloxUsername, newRank.name);
  } catch (error) {
    console.error(error);
    message.channel.send("An error occurred while trying to promote the user.");
  }
}

// Demote command
async function demoteUser(message, robloxUsername) {
  try {
    const userId = await noblox.getIdFromUsername(robloxUsername);
    if (!userId) {
      message.channel.send(`Could not find Roblox user ${robloxUsername}`);
      return;
    }

    const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
    const currentRank = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userId);

    const currentRoleIndex = roles.findIndex((r) => r.rank === currentRank);
    if (currentRoleIndex === -1) {
      message.channel.send(
        `Could not find current rank for user ${robloxUsername}`
      );
      return;
    }

    if (currentRoleIndex === 0) {
      message.channel.send(
        `${robloxUsername} is already at the lowest rank (${roles[currentRoleIndex].name})`
      );
      return;
    }

    const newRank = roles[currentRoleIndex - 1];

    await noblox.setRank(ROBLOX_GROUP_ID, userId, newRank.rank);
    message.channel.send(
      `Successfully demoted ${robloxUsername} to **${newRank.name}**`
    );

    await logCommand(message, "!demote", robloxUsername, newRank.name);
  } catch (error) {
    console.error(error);
    message.channel.send("An error occurred while trying to demote the user.");
  }
}

client.once("ready", async () => {
  console.log(`${client.user.tag} is online!`);
  await robloxLogin();
  
  // Auto-restart every 5 minutes
  setInterval(() => {
    console.log("Auto-restarting bot...");
    client.destroy();
    client.login(DISCORD_TOKEN);
  }, 5 * 60 * 1000); // 5 minutes in milliseconds
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // Check maintenance mode before processing any commands
  if (message.content.startsWith('!') && isMaintenanceMode && message.author.id !== '942051843306049576') {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('**Bot Unavailable**')
      .setDescription('❌ The bot is currently in maintenance mode.\nPlease try again later.')
      .setFooter({ text: 'We apologize for the inconvenience.' })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // Handle maintenance commands
  if (command === "!maintenance" && message.author.id === '942051843306049576') {
    isMaintenanceMode = true;
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

    return message.channel.send({ embeds: [embed] });
  }

  if (command === "!maintenanceover" && message.author.id === '942051843306049576') {
    isMaintenanceMode = false;
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('**Maintenance Complete**')
      .setDescription('The bot is back online and ready to serve you!')
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/190/190411.png')
      .addFields(
        { name: 'Status', value: 'Online', inline: true },
        { name: 'All Systems', value: 'Operational', inline: true }
      )
      .setFooter({ text: 'Thank you for your patience!', iconURL: message.client.user.displayAvatarURL() })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  

  if (!hasRankingPermission(message) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    if (message.content.startsWith('!promote') || message.content.startsWith('!demote') || 
        message.content.startsWith('!setrank') || message.content.startsWith('!ranklist')) {
      return message.reply("You need the 'Ranking Permission' role to use ranking commands.");
    }
    return;
  }

  if (command === "!promote") {
    if (args.length !== 1) {
      message.channel.send("Usage: !promote <roblox username>");
      return;
    }
    await promoteUser(message, args[0]);
  }

  if (command === "!demote") {
    if (args.length !== 1) {
      message.channel.send("Usage: !demote <roblox username>");
      return;
    }
    await demoteUser(message, args[0]);
  }

  if (command === "!ranklist") {
    try {
      const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
      const ranksPerPage = 10;
      const totalPages = Math.ceil(roles.length / ranksPerPage);
      let currentPage = 1;

      function getRankListPage(page) {
        const filteredRoles = roles.filter(role => role.rank !== 0);
        const start = (page - 1) * ranksPerPage;
        const end = start + ranksPerPage;
        const pageRoles = filteredRoles.slice(start, end);
        return pageRoles.map(role => `${role.rank} • **${role.name}**`).join('\n');
      }

      const rankEmbed = {
        color: 0x2F3136,
        title: '📋 Group Rank List',
        description: `Below are all available ranks in the group. Use the buttons to navigate between pages.\n\n**Page ${currentPage} of ${totalPages}**\n\n${getRankListPage(currentPage)}`,
        footer: { 
          text: `Total Ranks: ${roles.length} • Page ${currentPage}/${totalPages}`,
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

        rankEmbed.description = `Available ranks and their IDs (Page ${currentPage}/${totalPages}):\n\n${getRankListPage(currentPage)}`;

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

  if (command === "!setrank") {
    const robloxUsername = args[0];
    const rankId = parseInt(args[1]);

    if (!robloxUsername || isNaN(rankId)) {
      return message.channel.send(
        "Please provide a valid Roblox username and rank ID. Usage: !setrank <username> <rankID>"
      );
    }

    try {
      const userId = await noblox.getIdFromUsername(robloxUsername);
      if (!userId) {
        return message.channel.send(
          `Could not find user ${robloxUsername} on Roblox.`
        );
      }

      await noblox.setRank(ROBLOX_GROUP_ID, userId, rankId);

      const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
      const role = roles.find((r) => r.rank === rankId);
      const rankName = role ? role.name : "Unknown Rank";

      message.channel.send(
        `Successfully set ${robloxUsername}'s rank to **${rankName}**`
      );

      await logCommand(message, "!setrank", robloxUsername, `${rankName} (ID: ${rankId})`);
    } catch (error) {
      console.error("Error in !setrank command:", error);
      message.channel.send(
        "There was an error setting the rank. Please try again later."
      );
    }
  }

  if (command === "!rankhelp") {
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

  

  if (command === "!exile") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Only administrators can use the exile command.");
    }

    const robloxUsername = args[0];

    if (!robloxUsername) {
      return message.channel.send("Please provide a Roblox username. Usage: !exile <username>");
    }

    try {
      const userId = await noblox.getIdFromUsername(robloxUsername);
      if (!userId) {
        return message.channel.send(`Could not find user ${robloxUsername} on Roblox.`);
      }

      await noblox.exile(ROBLOX_GROUP_ID, userId);
      message.channel.send(`Successfully exiled ${robloxUsername} from the group.`);

      await logCommand(message, "!exile", robloxUsername, "Exiled from group");
    } catch (error) {
      console.error("Error in !exile command:", error);
      message.channel.send("There was an error exiling the user.");
    }
  }

  });

client.login(DISCORD_TOKEN);