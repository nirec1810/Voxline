import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { Server } from 'socket.io'
import { createServer } from 'node:http'
import './config/env.js'

import { initDB } from './config/db.js'
import { applySocketAuth, registerSocketHandlers } from './socket/handlers.js'
import authRouter from './routes/auth.js'

dotenv.config()

const PORT = process.env.PORT ?? 3000

async function main() {
  await initDB()

  const app    = express()
  const server = createServer(app)
  const io     = new Server(server, {
    connectionStateRecovery: { maxAttempts: 10, timeout: 1000 }
  })

  /* ── Express middleware ──────────────────────────────────── */
  app.use(logger('dev'))
  app.use(express.json())

  /* ── Routes ──────────────────────────────────────────────── */
  app.use('/auth', authRouter)

  app.get('/', (_req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
  })

  /* ── Socket.io ───────────────────────────────────────────── */
  applySocketAuth(io)
  registerSocketHandlers(io)

  /* ── Start ───────────────────────────────────────────────── */
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})