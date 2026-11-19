import { createServer } from 'http'

import { app } from './app'
import { env } from '@/env'
import { initSocket } from '@/socket'

// A single HTTP server serves both the Express app and the Socket.io connections
const server = createServer(app)

initSocket(server)

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`)
})
