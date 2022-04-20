require('dotenv/config')
const { Client, Util, VoiceChannel } = require('discord.js');
const client = new Client();
const ytdl = require('ytdl-core');
const Youtube = require('simple-youtube-api');

const queue = new Map();
const youtube = new Youtube(process.env.APIY);

const PREFIX = '-';

client.on('ready', () => {
    console.log("Bot Is Active!")

    setInterval(() => {
        const statuses = [
         `${client.guilds.cache.size} servers`,
         'Say -help',
        ]

     const status = statuses[Math.floor(Math.random() * statuses.length)]
     client.user.setActivity(status, { type: "WATCHING" })
    }, 2000)
});

client.on('message', message => {
    if(message.content.startsWith(`${PREFIX}help`)){
    message.channel.send(`
**Commands**
        
**-help** - Lists all commands.
**-play** (url/youtube name) - Plays the song.
**-skip** - Skips the current song playing.
**-stop** - Stops queue and ends songs.
**-volume** - Shows what the current volume is.
**-volume(0-7)** - Changes volume.
**-loop** - Enables/Disables loop, which loops the songs.
**-pause** - Pauses queue.
**-resume** - Resumes the queue.
**-queue** - Shows all songs in queue.
**-np** - Shows whats now playing.

**Check our website, http://tinkbot.unaux.com/ or email us at, tinkbothelp@gmail.com for support.**
        `)
    }
});

client.on('message', message => {
    if(message.content.startsWith(`${PREFIX}invite`)){
        message.channel.send(`**Add Our Bot To Your Server:** https://discord.com/oauth2/authorize?client_id=756932542250221728&scope=bot&permissions=37080128`)
    }
});

client.on('message', async message => {
    if(message.author.bot) return
    if(!message.content.startsWith(PREFIX)) return
    
    const args = message.content.substring(PREFIX.length).split(" ")
    const SearchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : ''
    const serverQueue = queue.get(message.guild.id)

    if(message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("You need to be in a voice channel to play a song.")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("I don\'t have permissions to connect to the voice channel please enable it.")
        if(!permissions.has('SPEAK')) return message.channel.send("I don\'t have permissions to speak in the voice channel please enable it.")

        if(url.match(/https?:\/\/(www.youtube.com | youtube.com) \/ playlist(.*)$/)) {
            const playList = await youtube.getPlaylist(url)
            const videos = await playList.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
        } else {
            try {
                var video = await youtube.getVideo(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(SearchString, 10)
                    var index = 0
                    message.channel.send(`
 __**Song Selection:**__                   
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}                   

Please Pick One Of These Songs From 1-10                  
                        `)
                        try {
                            var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
                                max: 1,
                                time: 30000,
                                errors: ['time']
                            })
                        } catch {
                            message.channel.send(`Invalid song selection number was provided.`)
                        }
                        const videoIndex = parseInt(responce.first().content)
                        var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
                    }  catch {
                        return message.channel.send("I couldn\'t find any search results.")
                    }
            }
            return handleVideo(video, message, voiceChannel)
        }

    } else if (message.content.startsWith(`${PREFIX}stop`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to stop the music!")
        if(!serverQueue) return message.channel.send("There is nothing currently playing.")
        serverQueue.songs = []
        serverQueue.connection.dispatcher.end()
        message.channel.send("The song has been stopped.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip a song!")
        if(!serverQueue) return message.channel.send("There is nothing currently playing.")
        serverQueue.connection.dispatcher.end()
        message.channel.send("The song has been skipped.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}volume`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to change the volume!")
        if(!serverQueue) return message.channel.send("There is nothing currently playing.")
        if(!args[1]) return message.channel.send(`The volume is **${serverQueue.volume}**`)
        if(isNaN(args[1])) return message.channel.send("That is not a valid amount to change the volume.") 
        if (args[1] > 7 || args[0] < 0) return message.channel.send('Value has to be between (0-7)!')
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5)
        message.channel.send(`The volume has been changed to: **${args[1]}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX}np`)) {
        if(!serverQueue) return message.channel.send("There is nothing currently playing.")
        message.channel.send(`Now playing: **${serverQueue.songs[0].title}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX }queue`)) {
        if(!serverQueue) return message.channel.send("There is nothing currently playing.")
        message.channel.send(`
__**Song Queue:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Now Playing:** ${serverQueue.songs[0].title}
        `, { split: true })
        return undefined 
    } else if(message.content.startsWith(`${PREFIX}pause`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to use pause the song!")
        if(!serverQueue) return message.channel.send("There is nothing currently playing.")
        if(!serverQueue.playing) return message.channel.send("The song is already paused.")
        serverQueue.playing = false
        serverQueue.connection.dispatcher.pause()
        message.channel.send("The song is now paused.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}resume`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to resume the song.")
        if(!serverQueue) return message.channel.send("There is nothing currently playing.")
        if(serverQueue.playing) return message.channel.send("The song is already playing.")
        serverQueue.playing = true
        serverQueue.connection.dispatcher.resume()
        message.channel.send("The song has been resumed.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}loop`)) {
        if(!message.member.voice.channel) return message.channel.send('You need to be in a voice channel to loop the song.')
        if(!serverQueue) return message.channel.send('There is nothing currently playing.')

        serverQueue.loop = !serverQueue.loop
        
        return message.channel.send(`I have now ${serverQueue.loop ? `**Enabled**` : `**Disabled**`} loop.`)
    }
});

async function handleVideo(video, message, voiceChannel, playList = false) {
    const serverQueue = queue.get(message.guild.id)

    const song = {
        id: video.id,
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.id}`
    } 

    if(!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5.,
            playing: true,
            loop: false
        }
        queue.set(message.guild.id, queueConstruct)

        queueConstruct.songs.push(song)
   
        try {
            var connection = await voiceChannel.join() .then(connection => {connection.voice.setSelfDeaf(true)
            queueConstruct.connection = connection
            play(message.guild, queueConstruct.songs[0])})
        } catch (error) {
            console.log(`There was an error connecting to the voice channel: ${error} Join our discord to report it! NMMqJMt`);
            queue.delete(message.guild.id)
            return message.channel.send(`There was an error connecting to the voice channel: ${error} Join our discord to report it! NMMqJMt`)
        }
    } else {
        serverQueue.songs.push(song)
        if(playList) return  undefined
        else return message.channel.send(`**${song.title}** added to the queue`)
    }
    return undefined
}
function play(guild, song) {
    const serverQueue = queue.get(guild.id)
    console.log(song)

    if(!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on('finish', () => {
        if(!serverQueue.loop) serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
    })
    .on('error', error => {
        console.log(error)
        return message.channel.send(`There was an error connecting to the voice channel: ${error} Join our discord to report it! NMMqJMt`)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)
    
    serverQueue.textChannel.send(`Now Playing: **${song.title}**`)
}

client.login(process.env.TOKEN);