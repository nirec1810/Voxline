import jwt from 'jsonwebtoken'
import { db } from '../config/db.js'

/* ── Auth middleware ─────────────────────────────────────── */
export function applySocketAuth(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token

    if (!token)
      return next(new Error('AUTH_REQUIRED'))

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      socket.username = payload.username
      next()
    } catch {
      next(new Error('AUTH_INVALID'))
    }
  })
}

/* ── DB helpers ──────────────────────────────────────────── */
async function saveMessage(content, username) {
  return db.execute({
    sql: 'INSERT INTO messages (content, user) VALUES (?, ?)',
    args: [content, username]
  })
}

async function getMissedMessages(serverOffset) {
  return db.execute({
    sql: 'SELECT id, content, user FROM messages WHERE id > ?',
    args: [serverOffset ?? 0]
  })
}

/* ── Handlers ────────────────────────────────────────────── */
export function registerSocketHandlers(io) {
  io.on('connection', async (socket) => {
    const { username } = socket
    console.log(`[socket] connected: ${username}`)

    socket.broadcast.emit('user:joined', username)

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${username} — ${reason}`)
      socket.broadcast.emit('user:left', username)
    })

    socket.on('chat message', async (msg) => {
      if (!msg || typeof msg !== 'string' || msg.trim().length === 0) return
      if (msg.length > 500) {
        socket.emit('error', 'Message too long (max 500 chars)')
        return
      }

      try {
        const result = await saveMessage(msg.trim(), username)
        io.emit('chat message', msg.trim(), result.lastInsertRowid.toString(), username)
      } catch (e) {
        console.error('[chat message]', e)
        socket.emit('error', 'Failed to send message')
      }
    })

    // Recover missed messages
    if (!socket.recovered) {
      try {
        const { rows } = await getMissedMessages(socket.handshake.auth.serverOffset)
        rows.forEach((row) => {
          socket.emit('chat message', row.content, row.id.toString(), row.user)
        })
      } catch (e) {
        console.error('[recovery]', e)
      }
    }
  })
}