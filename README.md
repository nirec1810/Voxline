# Voxline

> Chat en tiempo real con autenticación JWT, recuperación de mensajes e historial persistente.

Construido con **Node.js**, **Socket.io**, **Express** y **Turso (libSQL)**.

---

## Características

- Autenticación JWT — registro, inicio de sesión y sesiones persistentes via localStorage
- Mensajería en tiempo real con Socket.io
- Recuperación de mensajes al reconectarse (mensajes perdidos durante la desconexión)
- Presencia de usuarios — notificaciones de entrada y salida
- Cliente seguro contra XSS con escapado de HTML
- Validación de entradas en cliente y servidor
- Interfaz oscura con indicador de conexión animado

---

## Estructura del proyecto

```
voxline/
├── client/
│   └── index.html          # Pantalla de auth + chat (página única)
├── src/
│   ├── server.js            # Punto de entrada
│   ├── config/
│   │   ├── env.js           # Carga de dotenv (debe ser el primer import)
│   │   └── db.js            # Cliente Turso + inicialización de tablas
│   ├── routes/
│   │   └── auth.js          # POST /auth/register, POST /auth/login
│   └── socket/
│       └── handlers.js      # Middleware JWT + manejadores de eventos de chat
├── .env                     # Variables de entorno (no subir al repositorio)
├── .env.example
└── package.json
```

---

## Requisitos previos

- Node.js v18 o superior
- Una base de datos en [Turso](https://turso.tech) (el plan gratuito es suficiente)

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/voxline.git
cd voxline

# 2. Instalar dependencias
npm install

# 3. Configurar las variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver sección Configuración)

# 4. Iniciar el servidor
node src/server.js
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Configuración

Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=3000
DB_URL=libsql://tu-base-de-datos.aws-us-east-1.turso.io
DB_TOKEN=tu_token_de_turso
JWT_SECRET=una_cadena_larga_y_aleatoria_aqui
```

| Variable     | Descripción                                                  |
|--------------|--------------------------------------------------------------|
| `PORT`       | Puerto en el que escucha el servidor (por defecto: `3000`)   |
| `DB_URL`     | URL de la base de datos Turso                                |
| `DB_TOKEN`   | Token de autenticación de Turso (se obtiene en el dashboard) |
| `JWT_SECRET` | Secreto para firmar los JWT — mantenlo privado               |

Para generar un `JWT_SECRET` seguro:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Dependencias

```bash
npm install express morgan dotenv @libsql/client socket.io bcryptjs jsonwebtoken
```

| Paquete          | Uso                                       |
|------------------|-------------------------------------------|
| `express`        | Servidor HTTP y enrutamiento              |
| `morgan`         | Logger de peticiones HTTP                 |
| `dotenv`         | Carga de variables de entorno             |
| `@libsql/client` | Cliente para Turso / libSQL               |
| `socket.io`      | Transporte en tiempo real via WebSocket   |
| `bcryptjs`       | Hashing de contraseñas                    |
| `jsonwebtoken`   | Creación y verificación de JWT            |

---

## Referencia de la API

### `POST /auth/register`

Crea una nueva cuenta de usuario.

**Cuerpo:**
```json
{
  "username": "alice",
  "password": "secreto123"
}
```

**Restricciones:**
- `username`: 3–20 caracteres, solo letras, números, `_` y `-`
- `password`: mínimo 6 caracteres

**Respuestas:**

| Estado | Significado                         |
|--------|-------------------------------------|
| `201`  | Creado — devuelve el JWT            |
| `400`  | Error de validación                 |
| `409`  | El nombre de usuario ya está en uso |
| `500`  | Error interno del servidor          |

**Respuesta exitosa:**
```json
{
  "token": "eyJhbGci...",
  "username": "alice"
}
```

---

### `POST /auth/login`

Autentica a un usuario existente.

**Cuerpo:**
```json
{
  "username": "alice",
  "password": "secreto123"
}
```

**Respuestas:**

| Estado | Significado                |
|--------|----------------------------|
| `200`  | OK — devuelve el JWT       |
| `400`  | Faltan campos              |
| `401`  | Credenciales inválidas     |
| `500`  | Error interno del servidor |

---

## Eventos de Socket.io

El token JWT debe enviarse en el objeto `auth` del handshake:

```javascript
const socket = io({
  auth: {
    token: localStorage.getItem('token'),
    serverOffset: 0   // último ID de mensaje conocido para recuperación
  }
})
```

Si el token falta o es inválido, el servidor emite un `connect_error` con el mensaje `AUTH_REQUIRED` o `AUTH_INVALID` y desconecta el socket.

### Cliente → Servidor

| Evento         | Payload        | Descripción                               |
|----------------|----------------|-------------------------------------------|
| `chat message` | `string` (msg) | Enviar un mensaje (máximo 500 caracteres) |

### Servidor → Cliente

| Evento         | Payload                         | Descripción                                      |
|----------------|---------------------------------|--------------------------------------------------|
| `chat message` | `(msg, serverOffset, username)` | Nuevo mensaje difundido a todos los clientes     |
| `user:joined`  | `username`                      | Un usuario se conectó                            |
| `user:left`    | `username`                      | Un usuario se desconectó                         |
| `error`        | `string`                        | Error del servidor (ej. mensaje demasiado largo) |

---

## Esquema de la base de datos

Las tablas se crean automáticamente al iniciar el servidor por primera vez mediante `initDB()`.

```sql
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content    TEXT    NOT NULL,
  user       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## Notas de seguridad

- Las contraseñas se hashean con **bcrypt** (10 rondas de sal) — nunca se almacenan en texto plano
- Los JWT expiran después de **7 días**
- El `username` en los eventos del socket proviene del payload del JWT verificado, no del cliente — no puede ser suplantado
- Todo el contenido generado por usuarios es **escapado en HTML** antes de renderizarse para prevenir XSS
- `dotenv` se carga a través del módulo dedicado `config/env.js` importado primero, garantizando que las variables de entorno estén disponibles antes de que cualquier otro módulo se ejecute

---
