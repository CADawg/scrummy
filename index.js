const Discord = require('discord.js');
require('dotenv').config();

const client = new Discord.Client();

const app_owner = "discord id of owner";
const scrum_people = []; // List of discord id's as strings
const target_days = [1,3,5]; // Monday, Wednesday, Friday
const target_time = 12; // 12 PM UTC
let scrum_channels = {"channel id": {"done": {}, "last_message": null, "reminders": []}};

let evil_last_time = null;
let evil_scrum_mentions = null;

function idListToMentions() {
    let s = "";
    for (let p =0; p < scrum_people.length; p++) {
        if (s === "") {
            s += "<@" + scrum_people[p] + ">";
        } else {
            s += ", <@" + scrum_people[p] + ">";
        }
    }

    return s;
}

function getEmbed(channel) {
    let d = new Date();

    let peopleToDo = {...scrum_people};

    for (let user in channel.done) {
        if (channel.done.hasOwnProperty(user)) {
            let index = peopleToDo.indexOf(user);
            if (index !== -1) peopleToDo.splice(index, 1);
        }
    }

    let mentions = idListToMentions(peopleToDo);
    if (mentions === "") {
        return new Discord.MessageEmbed()
            .setColor('#e76609')
            .setTitle('Scrum Time!')
            .setAuthor('crumS', 'https://imgur.com/cITzLf7.png', 'https://conorhow.land')
            .setDescription('Today is a Scrum Day. You\'ve all submitted! 🎉🎉🎉')
            .setThumbnail('https://catjam.nitro.rest/.gif')
            .setTimestamp(d)
            .setFooter('Served Fresh For You', 'https://imgur.com/cITzLf7.png');
    } else {
        return new Discord.MessageEmbed()
            .setColor('#e76609')
            .setTitle('Scrum Time!')
            .setAuthor('crumS', 'https://imgur.com/cITzLf7.png', 'https://conorhow.land')
            .setDescription('Today is a Scrum Day. Please post updates below.')
            .setThumbnail('https://imgur.com/cITzLf7.png')
            .addFields({ name: 'Waiting On Submissions From', value: idListToMentions(peopleToDo)})
            .setTimestamp(d)
            .setFooter('Served Fresh For You', 'https://imgur.com/cITzLf7.png');
    }
}

function getNextOccurrence(addDays = 0) {
    let date = new Date();
    let futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + addDays);
    while (!target_days.includes(futureDate.getUTCDay())) {
        futureDate.setUTCDate(futureDate.getUTCDate() + 1);
    }
    futureDate.setUTCHours(target_time);
    futureDate.setUTCMinutes(0);
    futureDate.setUTCSeconds(1);
    futureDate.setUTCMilliseconds(0);

    return futureDate.getTime() - date.getTime();
}

async function evilInterval() {
    let date = new Date();
    if (date.getUTCDate() === evil_last_time.getUTCDate()) {
        for (let channel in scrum_channels) {
            if (scrum_channels.hasOwnProperty(channel)) {
                console.log(channel);
                let dc_channel = await client.channels.cache.get(channel);
                try {
                    let peopleToDo = {...scrum_people};

                    for (let user in channel.done) {
                        if (channel.done.hasOwnProperty(user)) {
                            let index = peopleToDo.indexOf(user);
                            if (index !== -1) peopleToDo.splice(index, 1);
                        }
                    }

                    if (peopleToDo.length > 0) {
                        scrum_channels[channel].reminders.push(await dc_channel.send("For today's scrum we still need submissions from: " + idListToMentions()));
                    } else {
                        clearInterval(evil_scrum_mentions);
                    }
                } catch (e) {}
            }
        }
    } else {
        clearInterval(evil_scrum_mentions);
    }
}

async function intervalRunner() {
    let date = new Date();
    if (target_days.includes(date.getUTCDay())) {
        if (date.getUTCHours() < target_time) {
            return setTimeout(intervalRunner, getNextOccurrence());
        } else if (date.getUTCHours() === target_time) {
            for (let channel in scrum_channels) {
                if (scrum_channels.hasOwnProperty(channel)) {
                    let dc_channel = await client.channels.cache.get(channel);
                    console.log(dc_channel);

                    scrum_channels[channel].done = {};
                    for (let r = 0; r < scrum_channels[channel].reminders.length; r++) {
                        // delete old reminders
                        try {
                            let message = await dc_channel.messages.cache.get(scrum_channels[channel].reminders[r]);
                            console.log(message);
                            await message.delete();
                        } catch (e) {}
                    }

                    scrum_channels[channel].last_message = await dc_channel.send(getEmbed(scrum_channels[channel]));

                    evil_last_time = new Date();
                    evil_scrum_mentions = setInterval(evilInterval, 14400000);
                }
            }

            // Must get a future occurrence as we've done today
            return setTimeout(intervalRunner, getNextOccurrence(1));
        }
    } else {
        return setTimeout(intervalRunner, getNextOccurrence());
    }
}

// when the client is ready, run this code
// this event will only trigger one time after logging in
client.once('ready', async () => {
    console.log('Ready!');

    await intervalRunner();
});

async function send_short_lived_message(channel, message, seconds = 5) {
    let msg = await channel.send(message);
    setTimeout(function () {
        msg.delete();
    }, 1000 * seconds); // delete message in 5 seconds.
}

client.on('message', async message => {
    if (message.content.startsWith("!") && message.author.id === app_owner) {
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'undo') {
            await message.delete();
            let users_mentioned = message.mentions.members.first();
            if (message.mentions.members.size === 0) {
                await send_short_lived_message(message.channel, "You didn't mention a user's submission to undo.");
                return;
            }
            let user_to_undo = users_mentioned.first();
            if (scrum_channels.hasOwnProperty(message.channel.id)) {
                if (scrum_channels[message.channel.id].done.hasOwnProperty(user_to_undo.id)) {
                    try {
                        let to_un_react = await message.channel.messages.fetch(scrum_channels[message.channel.id].done[user_to_undo.id]);
                        let thumbs_up = await to_un_react.reactions.resolve("👍");
                        await thumbs_up.users.remove(client.user.id);
                    } catch (e) {}
                    delete scrum_channels[message.channel.id].done[user_to_undo.id];
                    await scrum_channels[message.channel.id].last_message.edit(getEmbed(scrum_channels[message.channel.id]));
                    await send_short_lived_message(message.channel, `Removed ${message.mentions.members.first()}'s submission.`);
                } else {
                    await send_short_lived_message(message.channel, `${message.mentions.members.first()} hasn't submitted yet. Can't undo.`);
                }
            } else {
                await send_short_lived_message(message.channel, "This channel doesn't have " + client.user.username + " enabled!");
            }
        } else if (command === 'dump') {
            await message.delete();
            await send_short_lived_message(message.channel, "```\n" + JSON.stringify(scrum_channels) + "```\n Message will self-destruct in 20 Seconds.", 20);
        }

    } else if (scrum_channels.hasOwnProperty(message.channel.id)) {
      if (!message.author.bot && scrum_people.includes(message.author.id)) {
          if (!scrum_channels[message.channel.id].done.hasOwnProperty(message.author.id)) {
              try {
                  await message.react("👍");
              } catch (e) {}
              scrum_channels[message.channel.id].done[message.author.id] = message.id;
              try {
                  await scrum_channels[message.channel.id].last_message.edit(getEmbed(scrum_channels[message.channel.id]));
              } catch (e) {}
          }
      }
    }
});

client.login(process.env.DISCORD_TOKEN);
