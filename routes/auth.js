import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../config/db.js'

const router = Router()
const SALT_ROUNDS = 10

/* ── Helpers ─────────────────────────────────────────────── */
const createToken = (username) =>
  jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '3d' })

const isValidUsername = (u) => /^[a-zA-Z0-9_-]{3,20}$/.test(u)
const isValidPassword = (p) => typeof p === 'string' && p.length >= 6

/* ── POST /auth/register ─────────────────────────────────── */
router.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {}

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' })

  if (!isValidUsername(username))
    return res.status(400).json({ error: 'Username must be 3–20 chars (letters, numbers, _ -)' })

  if (!isValidPassword(password))
    return res.status(400).json({ error: 'Password must be at least 6 characters' })

  try {
    const exists = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username]
    })
    if (exists.rows.length)
      return res.status(409).json({ error: 'Username already taken' })

    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      args: [username, hash]
    })

    res.status(201).json({ token: createToken(username), username })
  } catch (e) {
    console.error('[register]', e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/* ── POST /auth/login ────────────────────────────────────── */
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' })

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username]
    })
    const user = result.rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' })

    res.json({ token: createToken(username), username })
  } catch (e) {
    console.error('[login]', e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router