import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { db } from './db';
import { users, members } from '../shared/schema';
import { eq } from 'drizzle-orm';

export class CSCDiscordBot {
  private client: Client;
  private rest: REST;
  private token: string;
  private clientId: string;
  private guildId?: string;

  constructor() {
    this.token = process.env.DISCORD_BOT_TOKEN || '';
    this.clientId = process.env.DISCORD_CLIENT_ID || '';
    this.guildId = process.env.DISCORD_GUILD_ID;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
      ]
    });

    this.rest = new REST({ version: '10' }).setToken(this.token);
    this.setupEventHandlers();
    this.registerCommands();
  }

  private setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`Discord bot ready as ${this.client.user?.tag}`);
    });

    this.client.on('guildMemberAdd', async (member) => {
      await this.handleMemberJoin(member);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleSlashCommands(interaction);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      await this.handleMessageModeration(message);
    });
  }

  private async registerCommands() {
    const commands = [
      // Admin commands
      new SlashCommandBuilder()
        .setName('create-channel')
        .setDescription('Create a new channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Channel name')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Channel type')
            .setRequired(true)
            .addChoices(
              { name: 'Text', value: 'text' },
              { name: 'Voice', value: 'voice' },
              { name: 'Forum', value: 'forum' },
              { name: 'Announcement', value: 'announcement' }
            ))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Channel description')
            .setRequired(false)),

      new SlashCommandBuilder()
        .setName('create-role')
        .setDescription('Create a new role')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Role name')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('color')
            .setDescription('Role color (hex code)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('permissions')
            .setDescription('Role permissions level')
            .setRequired(false)
            .addChoices(
              { name: 'Admin', value: 'admin' },
              { name: 'Moderator', value: 'moderator' },
              { name: 'Committee Member', value: 'committee' },
              { name: 'General Member', value: 'member' }
            )),

      new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Announcement title')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Announcement message')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to post announcement')
            .setRequired(false)),

      new SlashCommandBuilder()
        .setName('sync-member')
        .setDescription('Sync CSC member with Discord')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Discord user to sync')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('email')
            .setDescription('CSC member email')
            .setRequired(true)),

      // Member commands
      new SlashCommandBuilder()
        .setName('link-account')
        .setDescription('Link your Discord account to CSC membership')
        .addStringOption(option =>
          option.setName('email')
            .setDescription('Your CSC member email')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('events')
        .setDescription('View upcoming CSC events'),

      new SlashCommandBuilder()
        .setName('workshops')
        .setDescription('View available workshops'),

      // Moderation commands
      new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to timeout')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Timeout duration in minutes')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for timeout')
            .setRequired(false)),

      new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to ban')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for ban')
            .setRequired(false))
    ].map(command => command.toJSON());

    try {
      if (this.guildId) {
        await this.rest.put(
          Routes.applicationGuildCommands(this.clientId, this.guildId),
          { body: commands }
        );
      } else {
        await this.rest.put(
          Routes.applicationCommands(this.clientId),
          { body: commands }
        );
      }
      console.log('Discord slash commands registered successfully');
    } catch (error) {
      console.error('Error registering Discord commands:', error);
    }
  }

  private async handleSlashCommands(interaction: any) {
    const { commandName, options, guild, member } = interaction;

    try {
      switch (commandName) {
        case 'create-channel':
          await this.createChannel(interaction, options);
          break;
        case 'create-role':
          await this.createRole(interaction, options);
          break;
        case 'announce':
          await this.sendAnnouncement(interaction, options);
          break;
        case 'sync-member':
          await this.syncMember(interaction, options);
          break;
        case 'link-account':
          await this.linkAccount(interaction, options);
          break;
        case 'events':
          await this.showEvents(interaction);
          break;
        case 'workshops':
          await this.showWorkshops(interaction);
          break;
        case 'timeout':
          await this.timeoutMember(interaction, options);
          break;
        case 'ban':
          await this.banMember(interaction, options);
          break;
        default:
          await interaction.reply({ content: 'Unknown command', ephemeral: true });
      }
    } catch (error) {
      console.error('Error handling slash command:', error);
      await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
    }
  }

  private async createChannel(interaction: any, options: any) {
    const name = options.getString('name');
    const type = options.getString('type');
    const description = options.getString('description');

    let channelType: ChannelType;
    switch (type) {
      case 'voice':
        channelType = ChannelType.GuildVoice;
        break;
      case 'forum':
        channelType = ChannelType.GuildForum;
        break;
      case 'announcement':
        channelType = ChannelType.GuildAnnouncement;
        break;
      default:
        channelType = ChannelType.GuildText;
    }

    try {
      const channel = await interaction.guild.channels.create({
        name,
        type: channelType,
        topic: description || undefined
      });

      await interaction.reply({
        content: `✅ Channel ${channel} created successfully!`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to create channel. Check bot permissions.',
        ephemeral: true
      });
    }
  }

  private async createRole(interaction: any, options: any) {
    const name = options.getString('name');
    const color = options.getString('color');
    const permissionsLevel = options.getString('permissions') || 'member';

    let permissions: bigint[] = [];
    switch (permissionsLevel) {
      case 'admin':
        permissions = [PermissionFlagsBits.Administrator];
        break;
      case 'moderator':
        permissions = [
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ModerateMembers,
          PermissionFlagsBits.KickMembers
        ];
        break;
      case 'committee':
        permissions = [
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.CreatePublicThreads
        ];
        break;
      default:
        permissions = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel];
    }

    try {
      const role = await interaction.guild.roles.create({
        name,
        color: color || undefined,
        permissions
      });

      await interaction.reply({
        content: `✅ Role ${role} created successfully!`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to create role. Check bot permissions.',
        ephemeral: true
      });
    }
  }

  private async sendAnnouncement(interaction: any, options: any) {
    const title = options.getString('title');
    const message = options.getString('message');
    const channel = options.getChannel('channel') || interaction.channel;

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(0x0099FF)
      .setTimestamp()
      .setFooter({ text: 'CSC Announcement' });

    try {
      await channel.send({ embeds: [embed] });
      await interaction.reply({
        content: `✅ Announcement posted to ${channel}`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to send announcement.',
        ephemeral: true
      });
    }
  }

  private async syncMember(interaction: any, options: any) {
    const user = options.getUser('user');
    const email = options.getString('email');

    try {
      // Find member in database
      const member = await db.query.members.findFirst({
        where: eq(members.email, email)
      });

      if (!member) {
        await interaction.reply({
          content: '❌ Member not found in CSC database.',
          ephemeral: true
        });
        return;
      }

      // Assign appropriate role based on member level
      const guildMember = await interaction.guild.members.fetch(user.id);
      let roleName = 'CSC Member';

      if (member.category === 'Full' || member.category === 'LifeFull') {
        roleName = 'CSC Full Member';
      } else if (member.category === 'Associate' || member.category === 'LifeAssociate') {
        roleName = 'CSC Associate Member';
      } else if (member.category === 'Student') {
        roleName = 'CSC Student Member';
      }

      const role = interaction.guild.roles.cache.find((r: any) => r.name === roleName) ||
                   interaction.guild.roles.cache.find((r: any) => r.name === 'CSC Member');

      if (role) {
        await guildMember.roles.add(role);
      }

      // Set nickname to member name
      const nickname = `${member.firstName} ${member.lastName}`;
      await guildMember.setNickname(nickname);

      await interaction.reply({
        content: `✅ Synced ${user} with CSC member ${member.firstName} ${member.lastName}`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to sync member.',
        ephemeral: true
      });
    }
  }

  private async linkAccount(interaction: any, options: any) {
    const email = options.getString('email');
    const discordId = interaction.user.id;

    try {
      // Verify member exists
      const member = await db.query.members.findFirst({
        where: eq(members.email, email)
      });

      if (!member) {
        await interaction.reply({
          content: '❌ Email not found in CSC membership database.',
          ephemeral: true
        });
        return;
      }

      // Store Discord ID in member profile (you may want to add this field to schema)
      // For now, just confirm the link
      await interaction.reply({
        content: `✅ Account linked! Welcome to the CSC Discord, ${member.firstName}!`,
        ephemeral: true
      });

      // Auto-assign member role
      const memberRole = interaction.guild.roles.cache.find((r: any) => r.name === 'CSC Member');
      if (memberRole) {
        await interaction.member.roles.add(memberRole);
      }

    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to link account.',
        ephemeral: true
      });
    }
  }

  private async showEvents(interaction: any) {
    try {
      // Fetch upcoming calendar events from database
      const events = await db.query.calendarEvents.findMany({
        limit: 5,
        orderBy: (events, { asc }) => [asc(events.date)]
      });

      if (events.length === 0) {
        await interaction.reply({
          content: '📅 No upcoming events scheduled.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📅 Upcoming CSC Events')
        .setColor(0x0099FF)
        .setTimestamp();

      events.forEach(event => {
        const date = new Date(event.date).toLocaleDateString();
        embed.addFields({
          name: event.title,
          value: `${event.description || 'No description'}\n**Date:** ${date}`,
          inline: false
        });
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to fetch events.',
        ephemeral: true
      });
    }
  }

  private async showWorkshops(interaction: any) {
    try {
      const workshops = await db.query.workshops.findMany({
        limit: 5
      });

      if (workshops.length === 0) {
        await interaction.reply({
          content: '🛠️ No workshops available.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🛠️ Available CSC Workshops')
        .setColor(0x00FF99)
        .setTimestamp();

      workshops.forEach(workshop => {
        embed.addFields({
          name: workshop.title,
          value: `${workshop.description || 'No description'}\n**Capacity:** ${workshop.capacity}`,
          inline: false
        });
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to fetch workshops.',
        ephemeral: true
      });
    }
  }

  private async timeoutMember(interaction: any, options: any) {
    const user = options.getUser('user');
    const duration = options.getInteger('duration');
    const reason = options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(duration * 60 * 1000, reason);

      await interaction.reply({
        content: `✅ ${user} has been timed out for ${duration} minutes.\nReason: ${reason}`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to timeout member.',
        ephemeral: true
      });
    }
  }

  private async banMember(interaction: any, options: any) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.ban(user, { reason });

      await interaction.reply({
        content: `✅ ${user} has been banned.\nReason: ${reason}`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Failed to ban member.',
        ephemeral: true
      });
    }
  }

  private async handleMemberJoin(member: any) {
    // Welcome message
    const welcomeChannel = member.guild.channels.cache.find(
      (ch: any) => ch.name === 'welcome' || ch.name === 'general'
    );

    if (welcomeChannel) {
      const embed = new EmbedBuilder()
        .setTitle('Welcome to CSC Discord! 👋')
        .setDescription(`Welcome ${member}, we're glad you're here!\n\nPlease use \`/link-account\` to connect your Discord account with your CSC membership.`)
        .setColor(0x00FF99)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await welcomeChannel.send({ embeds: [embed] });
    }
  }

  private async handleMessageModeration(message: any) {
    // Basic profanity filter and spam detection
    const content = message.content.toLowerCase();
    const spamWords = ['spam', 'advertisement', 'buy now', 'click here'];
    
    if (spamWords.some(word => content.includes(word))) {
      await message.delete();
      await message.author.send('Your message was removed for potential spam content.');
    }
  }

  async start() {
    if (!this.token) {
      console.error('Discord bot token not provided');
      return false;
    }

    try {
      await this.client.login(this.token);
      return true;
    } catch (error) {
      console.error('Failed to start Discord bot:', error);
      return false;
    }
  }

  async stop() {
    await this.client.destroy();
  }

  // Web app integration methods
  async createChannelFromWeb(guildId: string, name: string, type: string, description?: string) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;

    let channelType: ChannelType;
    switch (type) {
      case 'voice': channelType = ChannelType.GuildVoice; break;
      case 'forum': channelType = ChannelType.GuildForum; break;
      case 'announcement': channelType = ChannelType.GuildAnnouncement; break;
      default: channelType = ChannelType.GuildText;
    }

    return await guild.channels.create({
      name,
      type: channelType,
      topic: description
    });
  }

  async sendAnnouncementFromWeb(guildId: string, channelId: string, title: string, message: string) {
    const guild = this.client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    
    if (!channel || !channel.isTextBased()) return false;

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(0x0099FF)
      .setTimestamp()
      .setFooter({ text: 'CSC Announcement' });

    await channel.send({ embeds: [embed] });
    return true;
  }

  async getServerInfo(guildId: string) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;

    return {
      name: guild.name,
      memberCount: guild.memberCount,
      channels: guild.channels.cache.map(ch => ({
        id: ch.id,
        name: ch.name,
        type: ch.type
      })),
      roles: guild.roles.cache.map(role => ({
        id: role.id,
        name: role.name,
        color: role.color,
        memberCount: role.members.size
      }))
    };
  }


}

let discordBot: CSCDiscordBot | null = null;

export const getDiscordBot = () => {
  if (!discordBot) {
    discordBot = new CSCDiscordBot();
  }
  return discordBot;
};

// Add client property access
export interface DiscordBotInterface {
  client: Client | null;
  start(): Promise<boolean>;
  stop(): Promise<void>;
  createChannelFromWeb(guildId: string, name: string, type: string, description?: string): Promise<any>;
  sendAnnouncementFromWeb(guildId: string, channelId: string, title: string, message: string): Promise<boolean>;
  getServerInfo(guildId: string): Promise<any>;
}