const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const SECRET = 'cargadores_secret_key';

// Conexión con la base de datos
 const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nkFXHBXbmppBcTmflSfpNrEFPzkpcjGJ@postgres.railway.internal:5432/railway',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Obtener todos los cargadores
app.get('/cargadores', async function(req, res) {
  const resultado = await pool.query('SELECT * FROM cargadores ORDER BY id');
  res.json(resultado.rows);
});

// Cambiar el estado de un cargador
app.patch('/cargadores/:id', async function(req, res) {
  const id = parseInt(req.params.id);
  const { estado } = req.body;
  await pool.query('UPDATE cargadores SET estado = $1 WHERE id = $2', [estado, id]);
  res.json({ mensaje: "Estado actualizado correctamente" });
});

// Añadir un nuevo cargador
app.post('/cargadores', async function(req, res) {
  const { nombre, ubicacion } = req.body;
  const resultado = await pool.query(
    'INSERT INTO cargadores (nombre, ubicacion, estado) VALUES ($1, $2, $3) RETURNING *',
    [nombre, ubicacion, 'disponible']
  );
  res.json(resultado.rows[0]);
});

// Arrancar el servidor
// Eliminar un cargador
app.delete('/cargadores/:id', async function(req, res) {
  const id = parseInt(req.params.id);
  await pool.query('DELETE FROM cargadores WHERE id = $1', [id]);
  res.json({ mensaje: "Cargador eliminado correctamente" });
});
// Registrar usuario
app.post('/registro', async function(req, res) {
  const { email, password, rol } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const resultado = await pool.query(
    'INSERT INTO usuarios (email, password, rol) VALUES ($1, $2, $3) RETURNING *',
    [email, hash, rol || 'admin']
  );
  res.json({ mensaje: "Usuario creado correctamente" });
});

// Login
app.post('/login', async function(req, res) {
  const { email, password } = req.body;
  const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  
  if (resultado.rows.length === 0) {
    return res.status(401).json({ error: "Usuario no encontrado" });
  }

  const usuario = resultado.rows[0];
  const passwordCorrecta = await bcrypt.compare(password, usuario.password);

  if (!passwordCorrecta) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  const token = jwt.sign({ id: usuario.id, email: usuario.email, rol: usuario.rol }, SECRET);
  res.json({ token, rol: usuario.rol });
});
// ✅ Después
const PORT = process.env.PORT || 4000;
app.listen(PORT, function() {
  console.log('Servidor corriendo en el puerto ' + PORT);
});