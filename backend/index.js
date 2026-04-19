const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || "proy2",
  host: process.env.DB_HOST || "db",
  database: process.env.DB_NAME || "tienda",
  password: process.env.DB_PASSWORD || "secret",
  port: Number(process.env.DB_PORT) || 5432,
});

app.get("/", (req, res) => {
  res.json({ message: "Backend de inventario y ventas activo" });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({
      status: "ok",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("Error verificando la base de datos:", error);
    res.status(500).json({ error: "Error conectando a la DB" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
