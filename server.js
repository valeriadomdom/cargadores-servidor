const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Lista de cargadores (de momento en memoria, luego será base de datos)
let cargadores = [
  { id: 1, nombre: "Cargador 01", ubicacion: "Madrid Centro", estado: "disponible" },
  { id: 2, nombre: "Cargador 02", ubicacion: "Madrid Norte", estado: "disponible" },
  { id: 3, nombre: "Cargador 03", ubicacion: "Madrid Sur", estado: "mantenimiento" },
  { id: 4, nombre: "Cargador 04", ubicacion: "Madrid Este", estado: "ocupado" },
];

// Ruta para obtener todos los cargadores
app.get('/cargadores', (req, res) => {
  res.json(cargadores);
});

// Ruta para cambiar el estado de un cargador
app.patch('/cargadores/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { estado } = req.body;
  
  cargadores = cargadores.map(c => 
    c.id === id ? { ...c, estado } : c
  );

  res.json({ mensaje: "Estado actualizado correctamente" });
});

// Arrancar el servidor
app.listen(4000, () => {
  console.log('Servidor corriendo en http://localhost:4000');
});