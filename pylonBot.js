const setupKv = new pylon.KVNamespace('setup');
const idKv = new pylon.KVNamespace('id');

const commands = new discord.command.CommandGroup({
  defaultPrefix: '!', // You can customize your default prefix here.
});

discord.interactions.commands.register(
  {
    name: 'ping',
    description: 'ping the bot',
  },
  async (interaction) => {
    await interaction.respond('pong!');
  }
);

discord.interactions.commands.register(
  {
    name: 'setup',
    description: 'set up the bot',
    options: (opts) => ({
      emoji: opts.string('the emoji to report with'),
      channel: opts.guildChannel('the channel to report to'),
    }),
  },
  async (interaction, opts) => {
    const emoji = opts.emoji.match(/<a?:(.+):(\d+)/);
    if (!emoji) {
      return await interaction.respond('you need to provide an emoji.');
    }

    // auth checks
    if (
      (BigInt(interaction.member.permissions) &
        BigInt(
          discord.Permissions.ADMINISTRATOR | discord.Permissions.MANAGE_GUILD
        )) ===
      0n
    ) {
      return await interaction.respond(
        "you don't have the permissions to do this!"
      );
    }

    const emoji_name = emoji[1];
    const emoji_id = emoji[2];

    await setupKv.put(interaction.guildId, {
      channel: opts.channel.id,
      emoji_id: emoji_id,
      emoji_name: emoji_name,
    });

    await interaction.respond('all set up!');
  }
);

discord.on('MESSAGE_REACTION_ADD', async (reaction) => {
  if (!reaction.guildId) return;

  const setup:
    | {
        channel: string;
        emoji_id: string;
        emoji_name: string;
      }
    | undefined = await setupKv.get(reaction.guildId);

  if (!setup)
    return await (
      await discord.getGuildTextChannel(reaction.channelId)
    )?.sendMessage('you need to set up the bot first.');

  if (
    reaction.emoji.id !== setup.emoji_id ||
    reaction.member!.user.getTag() == 'Starboard#9387'
  )
    return;

  // Build the rich embed
  const richEmbed = new discord.Embed();
  richEmbed.setTitle(`Report: ${reaction.messageId}`);
  richEmbed.setColor(0x00ff00);
  richEmbed.setDescription(`${reaction.member!.user.getTag()}`);
  richEmbed.setTimestamp(new Date().toISOString());

  const id: { id: string; names: string; time: string } | undefined =
    await idKv.get(reaction.messageId);
  if (id) {
    var prev_msg = await (
      await discord.getGuildTextChannel(setup.channel)
    )?.getMessage(id.id);

    if (prev_msg) {
      var report_names;
      if (id.names == '') {
        report_names = richEmbed.description;
      } else {
        report_names = id.names + ', ' + richEmbed.description;
      }

      richEmbed.setDescription(report_names);
      richEmbed.setTimestamp(id.time);

      await prev_msg.edit(richEmbed);
      await idKv.put(
        reaction.messageId,
        {
          id: id.id,
          names: report_names,
          time: richEmbed.timestamp,
        },
        { ttl: 1800000 }
      );
    }
  } else {
    const msg = await (
      await discord.getGuildTextChannel(setup.channel)
    )?.sendMessage(richEmbed);
    const ping_msg = await (
      await discord.getGuildTextChannel(setup.channel)
    )?.sendMessage('<@&' + '638902293965832235>');
    var msg_id = '';
    if (msg) msg_id = msg.id;

    await idKv.put(
      reaction.messageId,
      {
        id: msg_id,
        names: richEmbed.description,
        time: richEmbed.timestamp,
      },
      { ttl: 1800000 }
    );
  }
});

discord.on('MESSAGE_REACTION_REMOVE', async (reaction) => {
  if (!reaction.guildId) return;

  const setup:
    | {
        channel: string;
        emoji_id: string;
        emoji_name: string;
      }
    | undefined = await setupKv.get(reaction.guildId);

  if (!setup)
    return await (
      await discord.getGuildTextChannel(reaction.channelId)
    )?.sendMessage('you need to set up the bot first.');

  if (
    reaction.emoji.id !== setup.emoji_id ||
    reaction.member!.user.getTag() == 'Starboard#9387'
  )
    return;

  const id: { id: string; names: string; time: string } | undefined =
    await idKv.get(reaction.messageId);
  if (id) {
    var prev_msg = await (
      await discord.getGuildTextChannel(setup.channel)
    )?.getMessage(id.id);

    if (prev_msg) {
      const richEmbed = new discord.Embed();
      richEmbed.setTitle(`Report: ${reaction.messageId}`);
      richEmbed.setColor(0x00ff00);

      let del_index = id.names.indexOf(reaction.member!.user.getTag());
      var report_names;

      if (del_index == 0) {
        if (id.names.includes(',')) {
          report_names = id.names.replace(
            reaction.member!.user.getTag() + ', ',
            ''
          );
        } else {
          report_names = id.names.replace(reaction.member!.user.getTag(), '');
        }
      } else {
        report_names = id.names.replace(
          ', ' + reaction.member!.user.getTag(),
          ''
        );
      }
      richEmbed.setDescription(report_names);
      richEmbed.setTimestamp(id.time);

      await prev_msg.edit(richEmbed);
      await idKv.put(
        reaction.messageId,
        {
          id: id.id,
          names: report_names,
          time: richEmbed.timestamp,
        },
        { ttl: 1800000 }
      );
    }
  }
});
