const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const SECRET = process.env.JWT_SECRET || 'cargadores_secret_key';

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', 'https://cargadores-app.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// ─── BASE DE DATOS ─────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nkFXHBXbmppBcTmflSfpNrEFPzkpcjGJ@autorack.proxy.rlwy.net:43980/railway',
  ssl: { rejectUnauthorized: false }
});

// ─── FAVICON ───────────────────────────────────────────────────────────────────
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ─── SETUP: crear tablas ───────────────────────────────────────────────────────
app.get('/setup', async function (req, res) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'admin'
      )
    `);
    await pool.query(`
      DROP TABLE IF EXISTS cargadores;
      CREATE TABLE cargadores (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        ubicacion VARCHAR(255) NOT NULL,
        estado VARCHAR(50) DEFAULT 'disponible'
      )
    `);
    res.json({ ok: true, mensaje: 'Tablas creadas correctamente' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ─── TEST DB ───────────────────────────────────────────────────────────────────
app.get('/test', async function (req, res) {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, tiempo: result.rows[0] });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ─── MIDDLEWARE DE AUTENTICACIÓN ───────────────────────────────────────────────
function verificarToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.usuario = jwt.verify(auth.split(' ')[1], SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ─── RUTAS PÚBLICAS ────────────────────────────────────────────────────────────

app.get('/cargadores', async function (req, res) {
  try {
    const resultado = await pool.query('SELECT * FROM cargadores ORDER BY id');
    res.json(resultado.rows);
  } catch (err) {
    console.error('Error al obtener cargadores:', err.message);
    res.status(500).json({ error: 'Error al obtener cargadores' });
  }
});

app.post('/login', async function (req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    const usuario = resultado.rows[0];
    const passwordCorrecta = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecta) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, rol: usuario.rol });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.post('/registro', async function (req, res) {
  try {
    const { email, password, rol } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuarios (email, password, rol) VALUES ($1, $2, $3)',
      [email, hash, rol || 'admin']
    );
    res.status(201).json({ mensaje: 'Usuario creado correctamente' });
  } catch (err) {
    console.error('Error en registro:', err.message);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// ─── RUTAS PROTEGIDAS ──────────────────────────────────────────────────────────

app.post('/cargadores', verificarToken, async function (req, res) {
  try {
    const { nombre, ubicacion } = req.body;
    if (!nombre || !ubicacion) {
      return res.status(400).json({ error: 'Nombre y ubicación son requeridos' });
    }
    const resultado = await pool.query(
      'INSERT INTO cargadores (nombre, ubicacion, estado) VALUES ($1, $2, $3) RETURNING *',
      [nombre, ubicacion, 'disponible']
    );
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('Error al crear cargador:', err.message);
    res.status(500).json({ error: 'Error al crear cargador' });
  }
});

app.patch('/cargadores/:id', verificarToken, async function (req, res) {
  try {
    const id = parseInt(req.params.id);
    const { estado } = req.body;
    if (!estado) return res.status(400).json({ error: 'El estado es requerido' });
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const resultado = await pool.query(
      'UPDATE cargadores SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Cargador no encontrado' });
    res.json({ mensaje: 'Estado actualizado correctamente', cargador: resultado.rows[0] });
  } catch (err) {
    console.error('Error al actualizar cargador:', err.message);
    res.status(500).json({ error: 'Error al actualizar cargador' });
  }
});

app.delete('/cargadores/:id', verificarToken, async function (req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const resultado = await pool.query(
      'DELETE FROM cargadores WHERE id = $1 RETURNING *',
      [id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Cargador no encontrado' });
    res.json({ mensaje: 'Cargador eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar cargador:', err.message);
    res.status(500).json({ error: 'Error al eliminar cargador' });
  }
});

process.on('uncaughtException', function(err) {
  console.error('Error no capturado:', err.message);
});

process.on('unhandledRejection', function(err) {
  console.error('Promesa rechazada:', err.message);
});

// ─── ARRANQUE ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', function () {
  console.log('Servidor corriendo en el puerto ' + PORT);
});