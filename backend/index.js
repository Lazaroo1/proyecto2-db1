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

const viewSql = `
  CREATE OR REPLACE VIEW vista_resumen_ventas AS
  SELECT
    v.id_venta,
    v.fecha,
    c.nombre || ' ' || c.apellido AS cliente,
    e.nombre || ' ' || e.apellido AS empleado,
    COUNT(dv.id_detalle) AS lineas,
    SUM(dv.cantidad * dv.precio_unitario) AS total_venta
  FROM venta v
  JOIN cliente c ON c.id_cliente = v.id_cliente
  JOIN empleado e ON e.id_empleado = v.id_empleado
  JOIN detalle_venta dv ON dv.id_venta = v.id_venta
  GROUP BY v.id_venta, v.fecha, c.nombre, c.apellido, e.nombre, e.apellido;
`;

const dashboardDefinitions = [
  {
    id: "join_inventory",
    category: "JOIN",
    title: "Inventario por categoria y proveedor",
    description:
      "JOIN entre producto, categoria y proveedor para ver el catalogo completo.",
    columns: [
      { key: "producto", label: "Producto" },
      { key: "categoria", label: "Categoria" },
      { key: "proveedor", label: "Proveedor" },
      { key: "precio", label: "Precio" },
      { key: "stock", label: "Stock" },
    ],
    sql: `
      SELECT
        p.nombre AS producto,
        c.nombre AS categoria,
        pr.nombre AS proveedor,
        ROUND(p.precio::numeric, 2) AS precio,
        p.stock
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN proveedor pr ON pr.id_proveedor = p.id_proveedor
      ORDER BY c.nombre, p.nombre;
    `,
  },
  {
    id: "join_sales_detail",
    category: "JOIN",
    title: "Detalle de ventas recientes",
    description:
      "JOIN entre venta, cliente, empleado, detalle_venta y producto para ver cada linea vendida.",
    columns: [
      { key: "fecha", label: "Fecha" },
      { key: "cliente", label: "Cliente" },
      { key: "empleado", label: "Empleado" },
      { key: "producto", label: "Producto" },
      { key: "cantidad", label: "Cantidad" },
      { key: "subtotal", label: "Subtotal" },
    ],
    sql: `
      SELECT
        TO_CHAR(v.fecha, 'YYYY-MM-DD') AS fecha,
        c.nombre || ' ' || c.apellido AS cliente,
        e.nombre || ' ' || e.apellido AS empleado,
        p.nombre AS producto,
        dv.cantidad,
        ROUND((dv.cantidad * dv.precio_unitario)::numeric, 2) AS subtotal
      FROM venta v
      JOIN cliente c ON c.id_cliente = v.id_cliente
      JOIN empleado e ON e.id_empleado = v.id_empleado
      JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      JOIN producto p ON p.id_producto = dv.id_producto
      ORDER BY v.fecha DESC, cliente, producto
      LIMIT 20;
    `,
  },
  {
    id: "join_employee_sales",
    category: "JOIN",
    title: "Ventas por empleado",
    description:
      "JOIN entre empleado, venta y detalle_venta para medir ventas atendidas e ingresos generados.",
    columns: [
      { key: "empleado", label: "Empleado" },
      { key: "cargo", label: "Cargo" },
      { key: "ventas_atendidas", label: "Ventas" },
      { key: "ingresos_generados", label: "Ingresos" },
    ],
    sql: `
      SELECT
        e.nombre || ' ' || e.apellido AS empleado,
        e.cargo,
        COUNT(DISTINCT v.id_venta) AS ventas_atendidas,
        ROUND(SUM(dv.cantidad * dv.precio_unitario)::numeric, 2) AS ingresos_generados
      FROM empleado e
      JOIN venta v ON v.id_empleado = e.id_empleado
      JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      GROUP BY e.id_empleado, e.nombre, e.apellido, e.cargo
      ORDER BY ingresos_generados DESC, empleado;
    `,
  },
  {
    id: "subquery_above_avg",
    category: "SUBQUERY",
    title: "Productos sobre el promedio de su categoria",
    description:
      "Subquery correlacionado que compara el precio del producto contra el promedio de su propia categoria.",
    columns: [
      { key: "producto", label: "Producto" },
      { key: "categoria", label: "Categoria" },
      { key: "precio", label: "Precio" },
      { key: "promedio_categoria", label: "Promedio categoria" },
    ],
    sql: `
      SELECT
        p.nombre AS producto,
        c.nombre AS categoria,
        ROUND(p.precio::numeric, 2) AS precio,
        ROUND((
          SELECT AVG(p2.precio)
          FROM producto p2
          WHERE p2.id_categoria = p.id_categoria
        )::numeric, 2) AS promedio_categoria
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      WHERE p.precio > (
        SELECT AVG(p2.precio)
        FROM producto p2
        WHERE p2.id_categoria = p.id_categoria
      )
      ORDER BY c.nombre, p.precio DESC;
    `,
  },
  {
    id: "subquery_high_value_clients",
    category: "SUBQUERY",
    title: "Clientes con compras altas",
    description:
      "Subquery con EXISTS para encontrar clientes cuyo total historico supera Q600.",
    columns: [
      { key: "cliente", label: "Cliente" },
      { key: "email", label: "Email" },
      { key: "compras", label: "Compras" },
    ],
    sql: `
      SELECT
        c.nombre || ' ' || c.apellido AS cliente,
        c.email,
        COUNT(v.id_venta) AS compras
      FROM cliente c
      JOIN venta v ON v.id_cliente = c.id_cliente
      WHERE EXISTS (
        SELECT 1
        FROM venta v2
        JOIN detalle_venta dv2 ON dv2.id_venta = v2.id_venta
        WHERE v2.id_cliente = c.id_cliente
        GROUP BY v2.id_cliente
        HAVING SUM(dv2.cantidad * dv2.precio_unitario) > 600
      )
      GROUP BY c.id_cliente, c.nombre, c.apellido, c.email
      ORDER BY compras DESC, cliente;
    `,
  },
  {
    id: "aggregation_category_revenue",
    category: "GROUP BY + HAVING",
    title: "Ingresos por categoria",
    description:
      "Consulta con GROUP BY, HAVING y funciones de agregacion para mostrar categorias con mas de Q300 vendidos.",
    columns: [
      { key: "categoria", label: "Categoria" },
      { key: "productos", label: "Productos" },
      { key: "unidades_vendidas", label: "Unidades" },
      { key: "ingresos", label: "Ingresos" },
    ],
    sql: `
      SELECT
        c.nombre AS categoria,
        COUNT(DISTINCT p.id_producto) AS productos,
        SUM(dv.cantidad) AS unidades_vendidas,
        ROUND(SUM(dv.cantidad * dv.precio_unitario)::numeric, 2) AS ingresos
      FROM categoria c
      JOIN producto p ON p.id_categoria = c.id_categoria
      JOIN detalle_venta dv ON dv.id_producto = p.id_producto
      GROUP BY c.id_categoria, c.nombre
      HAVING SUM(dv.cantidad * dv.precio_unitario) > 300
      ORDER BY ingresos DESC, categoria;
    `,
  },
  {
    id: "cte_top_clients",
    category: "CTE",
    title: "Cliente top por mes",
    description:
      "Consulta WITH que calcula el cliente con mayor ingreso acumulado en cada mes.",
    columns: [
      { key: "mes", label: "Mes" },
      { key: "cliente", label: "Cliente top" },
      { key: "total_mes", label: "Total del mes" },
    ],
    sql: `
      WITH ventas_cliente_mes AS (
        SELECT
          DATE_TRUNC('month', v.fecha)::date AS mes,
          c.id_cliente,
          c.nombre || ' ' || c.apellido AS cliente,
          SUM(dv.cantidad * dv.precio_unitario) AS total_mes
        FROM venta v
        JOIN cliente c ON c.id_cliente = v.id_cliente
        JOIN detalle_venta dv ON dv.id_venta = v.id_venta
        GROUP BY DATE_TRUNC('month', v.fecha)::date, c.id_cliente, c.nombre, c.apellido
      ),
      ranking AS (
        SELECT
          mes,
          cliente,
          total_mes,
          ROW_NUMBER() OVER (PARTITION BY mes ORDER BY total_mes DESC) AS posicion
        FROM ventas_cliente_mes
      )
      SELECT
        TO_CHAR(mes, 'YYYY-MM') AS mes,
        cliente,
        ROUND(total_mes::numeric, 2) AS total_mes
      FROM ranking
      WHERE posicion = 1
      ORDER BY mes DESC;
    `,
  },
  {
    id: "view_sales_summary",
    category: "VIEW",
    title: "Resumen de ventas desde vista",
    description:
      "Datos obtenidos desde la VIEW vista_resumen_ventas para alimentar la interfaz.",
    columns: [
      { key: "id_venta", label: "Venta" },
      { key: "fecha", label: "Fecha" },
      { key: "cliente", label: "Cliente" },
      { key: "empleado", label: "Empleado" },
      { key: "lineas", label: "Lineas" },
      { key: "total_venta", label: "Total" },
    ],
    sql: `
      SELECT
        id_venta,
        TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
        cliente,
        empleado,
        lineas,
        ROUND(total_venta::numeric, 2) AS total_venta
      FROM vista_resumen_ventas
      ORDER BY fecha DESC, id_venta DESC
      LIMIT 20;
    `,
  },
];

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} debe ser un numero mayor a cero.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createHttpError(400, `${fieldName} debe ser un entero mayor o igual a cero.`);
  }

  return parsed;
}

async function ensureViewExists() {
  await pool.query(viewSql);
}

async function getDashboardSections() {
  await ensureViewExists();

  const sections = [];

  for (const definition of dashboardDefinitions) {
    const result = await pool.query(definition.sql);
    sections.push({
      id: definition.id,
      category: definition.category,
      title: definition.title,
      description: definition.description,
      columns: definition.columns,
      rows: result.rows,
    });
  }

  return sections;
}

async function getClients() {
  const result = await pool.query(`
    SELECT
      id_cliente,
      nombre,
      apellido,
      email,
      telefono
    FROM cliente
    ORDER BY nombre, apellido;
  `);

  return result.rows;
}

async function getProducts() {
  const result = await pool.query(`
    SELECT
      p.id_producto,
      p.nombre,
      ROUND(p.precio::numeric, 2) AS precio,
      p.stock,
      p.id_categoria AS "idCategoria",
      c.nombre AS categoria,
      p.id_proveedor AS "idProveedor",
      pr.nombre AS proveedor
    FROM producto p
    JOIN categoria c ON c.id_categoria = p.id_categoria
    JOIN proveedor pr ON pr.id_proveedor = p.id_proveedor
    ORDER BY p.nombre;
  `);

  return result.rows;
}

async function getOptions() {
  const [clients, employees, products, categories, providers] = await Promise.all([
    pool.query(`
      SELECT
        id_cliente,
        nombre || ' ' || apellido AS cliente
      FROM cliente
      ORDER BY cliente;
    `),
    pool.query(`
      SELECT
        id_empleado,
        nombre || ' ' || apellido || ' - ' || cargo AS empleado
      FROM empleado
      ORDER BY empleado;
    `),
    pool.query(`
      SELECT
        id_producto,
        nombre AS producto,
        ROUND(precio::numeric, 2) AS precio,
        stock
      FROM producto
      ORDER BY producto;
    `),
    pool.query(`
      SELECT
        id_categoria,
        nombre
      FROM categoria
      ORDER BY nombre;
    `),
    pool.query(`
      SELECT
        id_proveedor,
        nombre
      FROM proveedor
      ORDER BY nombre;
    `),
  ]);

  return {
    clients: clients.rows,
    employees: employees.rows,
    products: products.rows,
    categories: categories.rows,
    providers: providers.rows,
  };
}

async function getOverviewReport() {
  await ensureViewExists();

  const [metricsResult, topCategoriesResult, recentSalesResult] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM producto) AS total_productos,
        (SELECT COUNT(*) FROM cliente) AS total_clientes,
        (SELECT COALESCE(SUM(stock), 0) FROM producto) AS unidades_en_stock,
        (
          SELECT COALESCE(ROUND(SUM(total_venta)::numeric, 2), 0)
          FROM vista_resumen_ventas
          WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)
        ) AS ventas_mes_actual
    `),
    pool.query(`
      SELECT
        c.nombre AS categoria,
        ROUND(SUM(dv.cantidad * dv.precio_unitario)::numeric, 2) AS ingresos
      FROM categoria c
      JOIN producto p ON p.id_categoria = c.id_categoria
      JOIN detalle_venta dv ON dv.id_producto = p.id_producto
      GROUP BY c.id_categoria, c.nombre
      ORDER BY ingresos DESC
      LIMIT 5;
    `),
    pool.query(`
      SELECT
        id_venta,
        TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
        cliente,
        empleado,
        ROUND(total_venta::numeric, 2) AS total_venta
      FROM vista_resumen_ventas
      ORDER BY fecha DESC, id_venta DESC
      LIMIT 5;
    `),
  ]);

  return {
    metrics: metricsResult.rows[0],
    topCategories: topCategoriesResult.rows,
    recentSales: recentSalesResult.rows,
  };
}

function handleDatabaseError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error.code === "23503") {
    return res.status(409).json({
      error: "No se puede eliminar este registro porque esta siendo utilizado en otras tablas.",
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      error: "Ya existe un registro con esos datos unicos. Revisa los valores ingresados.",
    });
  }

  return res.status(500).json({ error: fallbackMessage });
}

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

app.get("/api/options", async (req, res) => {
  try {
    const options = await getOptions();
    res.json(options);
  } catch (error) {
    handleDatabaseError(res, error, "No se pudieron cargar las opciones del formulario.");
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const sections = await getDashboardSections();
    res.json({
      generatedAt: new Date().toISOString(),
      sections,
    });
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo cargar el dashboard SQL.");
  }
});

app.get("/api/reports/overview", async (req, res) => {
  try {
    const report = await getOverviewReport();
    res.json(report);
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo cargar el reporte ejecutivo.");
  }
});

app.get("/api/clients", async (req, res) => {
  try {
    const clients = await getClients();
    res.json(clients);
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo cargar la lista de clientes.");
  }
});

app.post("/api/clients", async (req, res) => {
  try {
    const nombre = normalizeText(req.body.nombre);
    const apellido = normalizeText(req.body.apellido);
    const email = normalizeText(req.body.email);
    const telefono = normalizeText(req.body.telefono);

    if (!nombre) {
      throw createHttpError(400, "El nombre del cliente es obligatorio.");
    }

    if (!apellido) {
      throw createHttpError(400, "El apellido del cliente es obligatorio.");
    }

    if (!email || !validateEmail(email)) {
      throw createHttpError(400, "Debes ingresar un correo electronico valido.");
    }

    const result = await pool.query(
      `
        INSERT INTO cliente (nombre, apellido, email, telefono)
        VALUES ($1, $2, $3, $4)
        RETURNING id_cliente, nombre, apellido, email, telefono;
      `,
      [nombre, apellido, email, telefono]
    );

    res.status(201).json({
      message: "Cliente creado correctamente.",
      client: result.rows[0],
    });
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo crear el cliente.");
  }
});

app.put("/api/clients/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nombre = normalizeText(req.body.nombre);
    const apellido = normalizeText(req.body.apellido);
    const email = normalizeText(req.body.email);
    const telefono = normalizeText(req.body.telefono);

    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, "El cliente seleccionado no es valido.");
    }

    if (!nombre) {
      throw createHttpError(400, "El nombre del cliente es obligatorio.");
    }

    if (!apellido) {
      throw createHttpError(400, "El apellido del cliente es obligatorio.");
    }

    if (!email || !validateEmail(email)) {
      throw createHttpError(400, "Debes ingresar un correo electronico valido.");
    }

    const result = await pool.query(
      `
        UPDATE cliente
        SET nombre = $1, apellido = $2, email = $3, telefono = $4
        WHERE id_cliente = $5
        RETURNING id_cliente, nombre, apellido, email, telefono;
      `,
      [nombre, apellido, email, telefono, id]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, "No se encontro el cliente a editar.");
    }

    res.json({
      message: "Cliente actualizado correctamente.",
      client: result.rows[0],
    });
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo actualizar el cliente.");
  }
});

app.delete("/api/clients/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, "El cliente seleccionado no es valido.");
    }

    const result = await pool.query(
      `
        DELETE FROM cliente
        WHERE id_cliente = $1
        RETURNING id_cliente;
      `,
      [id]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, "No se encontro el cliente a eliminar.");
    }

    res.json({ message: "Cliente eliminado correctamente." });
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo eliminar el cliente.");
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo cargar la lista de productos.");
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const nombre = normalizeText(req.body.nombre);
    const precio = parsePositiveNumber(req.body.precio, "El precio");
    const stock = parseNonNegativeInteger(req.body.stock, "El stock");
    const idCategoria = Number(req.body.idCategoria);
    const idProveedor = Number(req.body.idProveedor);

    if (!nombre) {
      throw createHttpError(400, "El nombre del producto es obligatorio.");
    }

    if (!Number.isInteger(idCategoria) || idCategoria <= 0) {
      throw createHttpError(400, "Debes seleccionar una categoria valida.");
    }

    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
      throw createHttpError(400, "Debes seleccionar un proveedor valido.");
    }

    const result = await pool.query(
      `
        INSERT INTO producto (nombre, precio, stock, id_categoria, id_proveedor)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id_producto;
      `,
      [nombre, precio, stock, idCategoria, idProveedor]
    );

    const products = await getProducts();
    const product = products.find((item) => item.id_producto === result.rows[0].id_producto);

    res.status(201).json({
      message: "Producto creado correctamente.",
      product,
    });
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo crear el producto.");
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nombre = normalizeText(req.body.nombre);
    const precio = parsePositiveNumber(req.body.precio, "El precio");
    const stock = parseNonNegativeInteger(req.body.stock, "El stock");
    const idCategoria = Number(req.body.idCategoria);
    const idProveedor = Number(req.body.idProveedor);

    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, "El producto seleccionado no es valido.");
    }

    if (!nombre) {
      throw createHttpError(400, "El nombre del producto es obligatorio.");
    }

    if (!Number.isInteger(idCategoria) || idCategoria <= 0) {
      throw createHttpError(400, "Debes seleccionar una categoria valida.");
    }

    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
      throw createHttpError(400, "Debes seleccionar un proveedor valido.");
    }

    const result = await pool.query(
      `
        UPDATE producto
        SET nombre = $1, precio = $2, stock = $3, id_categoria = $4, id_proveedor = $5
        WHERE id_producto = $6
        RETURNING id_producto;
      `,
      [nombre, precio, stock, idCategoria, idProveedor, id]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, "No se encontro el producto a editar.");
    }

    const products = await getProducts();
    const product = products.find((item) => item.id_producto === result.rows[0].id_producto);

    res.json({
      message: "Producto actualizado correctamente.",
      product,
    });
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo actualizar el producto.");
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, "El producto seleccionado no es valido.");
    }

    const result = await pool.query(
      `
        DELETE FROM producto
        WHERE id_producto = $1
        RETURNING id_producto;
      `,
      [id]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, "No se encontro el producto a eliminar.");
    }

    res.json({ message: "Producto eliminado correctamente." });
  } catch (error) {
    handleDatabaseError(res, error, "No se pudo eliminar el producto.");
  }
});

app.post("/api/transactions/sales", async (req, res) => {
  const { clientId, employeeId, productId, quantity } = req.body;
  const saleQuantity = Number(quantity);
  const dbClient = await pool.connect();

  try {
    if (!clientId || !employeeId || !productId || !saleQuantity) {
      throw createHttpError(400, "Debes completar cliente, empleado, producto y cantidad.");
    }

    if (!Number.isInteger(saleQuantity) || saleQuantity <= 0) {
      throw createHttpError(400, "La cantidad debe ser un entero mayor a cero.");
    }

    await dbClient.query("BEGIN");

    const productResult = await dbClient.query(
      `
        SELECT id_producto, nombre, precio, stock
        FROM producto
        WHERE id_producto = $1
        FOR UPDATE;
      `,
      [productId]
    );

    if (productResult.rowCount === 0) {
      throw createHttpError(404, "El producto seleccionado no existe.");
    }

    const product = productResult.rows[0];

    if (saleQuantity > Number(product.stock)) {
      throw createHttpError(
        400,
        `Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`
      );
    }

    const saleResult = await dbClient.query(
      `
        INSERT INTO venta (fecha, id_cliente, id_empleado)
        VALUES (CURRENT_TIMESTAMP, $1, $2)
        RETURNING id_venta, fecha;
      `,
      [clientId, employeeId]
    );

    await dbClient.query(
      `
        INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario)
        VALUES ($1, $2, $3, $4);
      `,
      [saleResult.rows[0].id_venta, productId, saleQuantity, product.precio]
    );

    const stockResult = await dbClient.query(
      `
        UPDATE producto
        SET stock = stock - $1
        WHERE id_producto = $2
        RETURNING stock;
      `,
      [saleQuantity, productId]
    );

    await dbClient.query("COMMIT");

    res.status(201).json({
      message: "Venta registrada correctamente.",
      saleId: saleResult.rows[0].id_venta,
      fecha: saleResult.rows[0].fecha,
      producto: product.nombre,
      cantidad: saleQuantity,
      total: Number(product.precio) * saleQuantity,
      stockRestante: stockResult.rows[0].stock,
    });
  } catch (error) {
    try {
      await dbClient.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error ejecutando ROLLBACK:", rollbackError);
    }

    handleDatabaseError(
      res,
      error,
      "No se pudo registrar la venta. La transaccion hizo ROLLBACK."
    );
  } finally {
    dbClient.release();
  }
});

app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
