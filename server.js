import './config/env.js'

import express from 'express'
import logger from 'morgan'
import { Server } from 'socket.io'
import { createServer } from 'node:http'

import { initDB } from './config/db.js'
import { applySocketAuth, registerSocketHandlers } from './socket/handlers.js'
import authRouter from './routes/auth.js'

const PORT = process.env.PORT ?? 3000  // Railway inyecta PORT automáticamente

async function main() {
  await initDB()

  const app    = express()
  const server = createServer(app)
  const io     = new Server(server, {
    connectionStateRecovery: { maxAttempts: 10, timeout: 1000 }
  })

  /* ── Middleware ──────────────────────────────────────────── */
  app.use(logger('dev'))
  app.use(express.json())

  /* ── Rutas ───────────────────────────────────────────────── */
  app.use('/auth', authRouter)

  // Health check para Railway
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  app.get('/', (_req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
  })

  /* ── Socket.io ───────────────────────────────────────────── */
  applySocketAuth(io)
  registerSocketHandlers(io)

  /* ── Arranque ────────────────────────────────────────────── */
  server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('Error al iniciar el servidor:', err)
  process.exit(1)
})