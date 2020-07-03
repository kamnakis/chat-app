const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')

const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

// Express configuration variables
const port = process.env.PORT
const publicDirectoryPath = path.join(__dirname, '../public')

// Express configuration
app.use(express.json())
app.use(express.static(publicDirectoryPath))

// Listen on client events
io.on('connection', (socket) => {
    // Print when new client is connected
    console.log('New websocket connection!')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    // Get the message from client and send it back to users
    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, message)) // Send a message to be printed on client's DOM
        callback()
    })

    // Share with users when a user has left
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`)) // Send a message to be printed on client's console
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })

    // Get location from client and send it back to users
    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)

        io.to(user.room).emit('location', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.longitude},${coords.latitude}`))
        callback()
    })
})


server.listen(port, () => {
    console.log('Server is up on port ' + port)
})