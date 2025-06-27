import { app } from './app';
import { env } from '@/env';
import { createServer } from 'http'
import { Server } from 'socket.io'

const server = createServer(app); // Your HTTP server that handles Express requests

const connectedUsers = new Map();

export const io = new Server(server, { // Socket.IO is attached to the existing HTTP server
  cors: {
    origin: `http://localhost:8080`,
  }
})

io.on('connection', (socket) => {
  console.log({ connectedUsers: connectedUsers.size })
  socket.on('user_connected', (user) => {
    connectedUsers.set(socket.id, {
      socket: socket,
      user: user
    });
    updateUserList()
  })

  socket.on('chat:user_joined', ({ channel, user }) => {
    socket.join(channel);
  });

  socket.on('chat:user_left', ({ channel }) => {
    socket.leave(channel);
  })


  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id); // Remove user from our map
      updateUserList(); // Notify clients about updated user list
    }
  });

  function updateUserList() {
    const users = Array.from(connectedUsers.values()).map(user => ({
      id: user.socket.id,
      user: user.user
    }));

    console.log({ users })
    io.emit('user:list_updated', users); // Emit to all clients
  }
});

// ONLY listen on the 'server'(your http server)
// This single listen call will serve both your Express app and your Socket.IO connections.
server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

export { server }