# Documentación Técnica — OmniMarket

**Proyecto 2 — Bases de Datos 1**  
**Lázaro Díaz — 24713**  
**Universidad del Valle de Guatemala — Ciclo 1, 2026**

---

## 1. Descripción general

OmniMarket es un sistema web para gestionar el inventario y las ventas de una tienda de retail general. La tienda maneja productos de categorías variadas (electrónica, ropa, hogar, deportes, belleza, entre otras) agrupados por categorías y adquiridos a distintos proveedores. Los clientes realizan compras atendidas por empleados, y el sistema registra cada transacción con su detalle.

El sistema cubre el ciclo completo: desde la gestión del catálogo y el inventario hasta el registro de ventas, generación de reportes y exportación de datos.

---

## 2. Objetivos

### Objetivo general

Diseñar, implementar y desplegar una aplicación web full-stack que gestione el inventario y las ventas de una tienda, integrando una base de datos relacional con consultas SQL avanzadas visibles en la interfaz.

### Objetivos específicos

- Diseñar un esquema relacional normalizado que modele correctamente el dominio de negocio.
- Implementar consultas SQL avanzadas (JOINs múltiples, subqueries, CTEs, vistas) ejecutadas directamente desde la aplicación web.
- Garantizar la integridad de las transacciones de venta mediante `BEGIN / COMMIT / ROLLBACK` explícitos.
- Proveer una interfaz usable con CRUD completo, reportes en tiempo real y exportación a PDF.
- Desplegar toda la infraestructura mediante Docker Compose, asegurando reproducibilidad.

---

## 3. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React 19 + Vite | SPA moderna, renderizado reactivo, sin dependencias de routing externas |
| Backend | Node.js + Express | Ligero, sin ORM, permite SQL explícito con el driver `pg` |
| Base de datos | PostgreSQL 15 | Soporte robusto para CTEs, window functions, vistas y transacciones ACID |
| Autenticación | Cookie HttpOnly + sesiones en memoria | Más seguro que JWT en localStorage contra XSS |
| Contenedorización | Docker Compose | Reproducibilidad total del entorno en un solo comando |

---

## 4. Diseño de base de datos

### 4.1 Entidades principales

| Tabla | Descripción |
|---|---|
| `categoria` | Agrupa los productos por tipo |
| `proveedor` | Empresa que suministra los productos |
| `producto` | Artículo del inventario con precio y stock |
| `cliente` | Persona que realiza compras |
| `empleado` | Personal de la tienda que atiende ventas |
| `usuario` | Cuenta de acceso al sistema, vinculada a un empleado |
| `venta` | Cabecera de una transacción de venta |
| `detalle_venta` | Líneas de productos por venta con precio capturado |

### 4.2 Relaciones principales
categoria  ──< producto >── proveedor
cliente    ──< venta    >── empleado
venta      ──< detalle_venta >── producto
empleado   ──  usuario

### 4.3 Vista creada

```sql
CREATE OR REPLACE VIEW vista_resumen_ventas AS
SELECT
  v.id_venta,
  v.fecha,
  c.nombre || ' ' || c.apellido AS cliente,
  e.nombre || ' ' || e.apellido AS empleado,
  COUNT(dv.id_detalle)          AS lineas,
  SUM(dv.cantidad * dv.precio_unitario) AS total_venta
FROM venta v
JOIN cliente c ON c.id_cliente = v.id_cliente
JOIN empleado e ON e.id_empleado = v.id_empleado
JOIN detalle_venta dv ON dv.id_venta = v.id_venta
GROUP BY v.id_venta, v.fecha, c.nombre, c.apellido, e.nombre, e.apellido;
```

Esta vista es utilizada por el backend para alimentar el reporte ejecutivo y la sección del dashboard de tipo VIEW.

### 4.4 Índices definidos

```sql
CREATE INDEX idx_producto_id_categoria ON producto(id_categoria);
CREATE INDEX idx_venta_fecha           ON venta(fecha);
CREATE INDEX idx_detalle_venta_id_venta ON detalle_venta(id_venta);
```

**Justificación:**
- `idx_producto_id_categoria`: acelera los JOINs y filtros por categoría, que aparecen en múltiples consultas del dashboard.
- `idx_venta_fecha`: optimiza el filtro de ventas por mes en el reporte ejecutivo (`WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)`).
- `idx_detalle_venta_id_venta`: mejora el rendimiento de los JOINs entre `venta` y `detalle_venta`, que son el núcleo de la mayoría de consultas analíticas.

---

## 5. Endpoints de la API

Todos los endpoints bajo `/api/*` (excepto `/api/auth/*` y `/api/health`) requieren sesión activa mediante cookie.

### 5.1 Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicia sesión. Recibe `{ username, password }`. Devuelve datos del usuario y establece cookie. |
| `POST` | `/api/auth/logout` | Cierra sesión. Invalida la cookie y borra la sesión del servidor. |
| `GET` | `/api/auth/me` | Verifica si hay sesión activa. Devuelve datos del usuario o 401. |

### 5.2 Opciones de formulario

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/options` | Devuelve listas de clientes, empleados, productos, categorías y proveedores para poblar los selectores de la UI. |

### 5.3 Clientes

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/clients` | Lista todos los clientes ordenados por nombre. |
| `POST` | `/api/clients` | Crea un cliente. Valida nombre, apellido y email. |
| `PUT` | `/api/clients/:id` | Actualiza un cliente existente. |
| `DELETE` | `/api/clients/:id` | Elimina un cliente. Retorna 409 si tiene ventas asociadas. |

**Ejemplo de body para POST/PUT:**
```json
{
  "nombre": "Ana",
  "apellido": "Morales",
  "email": "ana.morales@gmail.com",
  "telefono": "+502 5412-1001"
}
```

### 5.4 Productos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/products` | Lista todos los productos con nombre de categoría y proveedor (JOIN implícito). |
| `POST` | `/api/products` | Crea un producto. Requiere nombre, precio, stock, idCategoria, idProveedor. |
| `PUT` | `/api/products/:id` | Actualiza un producto existente. |
| `DELETE` | `/api/products/:id` | Elimina un producto. Retorna 409 si tiene ventas asociadas. |

**Ejemplo de body para POST/PUT:**
```json
{
  "nombre": "iPhone 13",
  "precio": 799.00,
  "stock": 18,
  "idCategoria": 1,
  "idProveedor": 1
}
```

### 5.5 Reportes

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/reports/overview` | Devuelve métricas generales, top categorías y ventas recientes. |
| `GET` | `/api/reports/overview/pdf` | Genera y descarga el reporte ejecutivo como archivo PDF. |

### 5.6 Dashboard SQL

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/dashboard` | Ejecuta las 8 consultas SQL del dashboard y las devuelve con metadatos (título, categoría, columnas, filas). |

### 5.7 Transacciones

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/transactions/sales` | Registra una venta completa con `BEGIN / COMMIT / ROLLBACK`. |

**Body:**
```json
{
  "clientId": 1,
  "employeeId": 4,
  "productId": 2,
  "quantity": 3
}
```

**Respuesta exitosa:**
```json
{
  "message": "Venta registrada correctamente.",
  "saleId": 26,
  "fecha": "2026-05-03T15:30:00.000Z",
  "producto": "Samsung Galaxy A54",
  "cantidad": 3,
  "total": 1347.00,
  "stockRestante": 21
}
```

### 5.8 Utilitarios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Verifica conexión a la base de datos. Devuelve `{ status: "ok", databaseTime }`. |

---

## 6. Consultas SQL implementadas

### 6.1 JOINs

**Inventario por categoría y proveedor**
```sql
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
```

**Detalle de ventas recientes** — JOIN de 5 tablas
```sql
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
ORDER BY v.fecha DESC
LIMIT 20;
```

**Ventas por empleado**
```sql
SELECT
  e.nombre || ' ' || e.apellido AS empleado,
  e.cargo,
  COUNT(DISTINCT v.id_venta) AS ventas_atendidas,
  ROUND(SUM(dv.cantidad * dv.precio_unitario)::numeric, 2) AS ingresos_generados
FROM empleado e
JOIN venta v ON v.id_empleado = e.id_empleado
JOIN detalle_venta dv ON dv.id_venta = v.id_venta
GROUP BY e.id_empleado, e.nombre, e.apellido, e.cargo
ORDER BY ingresos_generados DESC;
```

### 6.2 Subqueries

**Productos sobre el promedio de su categoría** — subquery correlacionado
```sql
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
```

**Clientes con compras altas** — EXISTS
```sql
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
ORDER BY compras DESC;
```

### 6.3 GROUP BY + HAVING

**Ingresos por categoría** — solo categorías con más de Q300 vendidos
```sql
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
ORDER BY ingresos DESC;
```

### 6.4 CTE (WITH)

**Cliente top por mes** — usa `ROW_NUMBER()` como window function
```sql
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
    mes, cliente, total_mes,
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
```

### 6.5 VIEW

```sql
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
```

---

## 7. Transacción de ventas

La ruta `POST /api/transactions/sales` implementa la única operación de escritura crítica del sistema. El flujo completo es:

Cliente HTTP
│
▼
BEGIN (transacción explícita)
│
├─▶ SELECT ... FOR UPDATE   ← bloquea la fila del producto
│                              para evitar race conditions
│
├─▶ Validar stock disponible
│   └── Si insuficiente: THROW → ROLLBACK
│
├─▶ INSERT INTO venta
│
├─▶ INSERT INTO detalle_venta
│
├─▶ UPDATE producto SET stock = stock - cantidad
│
└─▶ COMMIT
│
└── Si cualquier paso falla → ROLLBACK automático

**Código relevante (backend/index.js):**
```javascript
await dbClient.query("BEGIN");

const productResult = await dbClient.query(
  `SELECT id_producto, nombre, precio, stock
   FROM producto WHERE id_producto = $1 FOR UPDATE`,
  [productId]
);

if (saleQuantity > Number(product.stock)) {
  throw createHttpError(400, `Stock insuficiente. Solo hay ${product.stock} unidades.`);
}

await dbClient.query(
  `INSERT INTO venta (fecha, id_cliente, id_empleado) VALUES (CURRENT_TIMESTAMP, $1, $2)`,
  [clientId, employeeId]
);

// ... detalle y descuento de stock ...

await dbClient.query("COMMIT");
```

```javascript
} catch (error) {
  await dbClient.query("ROLLBACK");
  handleDatabaseError(res, error, "La transacción hizo ROLLBACK.");
}
```

---

## 8. Autenticación

El sistema usa sesiones en memoria del servidor, sin JWT ni base de datos de sesiones.

**Flujo de login:**
1. El cliente envía `{ username, password }` a `POST /api/auth/login`
2. El backend busca el usuario en la tabla `usuario` y compara el hash SHA-256 de la contraseña
3. Si es válido, genera un token aleatorio de 64 caracteres hexadecimales y lo almacena en un `Map` con datos del usuario y expiración de 8 horas
4. El token se envía al cliente como cookie `HttpOnly; SameSite=Lax`
5. En cada request protegido, el backend lee la cookie, valida el token y renueva la expiración

**Por qué cookie HttpOnly en lugar de JWT en localStorage:**
Las cookies HttpOnly no son accesibles por JavaScript en el navegador, lo que elimina el vector de ataque XSS más común contra tokens de autenticación.

---

## 9. Datos de prueba

El archivo `db/data.sql` contiene registros realistas para el dominio de una tienda:

| Tabla | Registros | Notas |
|---|---|---|
| `categoria` | 25 | Electrónica, ropa, hogar, deportes, etc. |
| `proveedor` | 25 | Proveedores con direcciones en Guatemala |
| `producto` | 25 | Productos de marcas reales con precios en USD |
| `cliente` | 25 | Nombres guatemaltecos, emails y teléfonos +502 |
| `empleado` | 25 | Con cargos reales de tienda departamental |
| `usuario` | 3 | admin, ventas, inventario |
| `venta` | 25 | Distribuidas de sep 2025 a abr 2026 |
| `detalle_venta` | 50 | 2 líneas por venta aproximadamente |

---

## 10. Decisiones de diseño

### ¿Por qué un solo archivo `backend/index.js`?

Para el alcance del proyecto y facilitar la evaluación del código, mantener toda la lógica en un archivo permite ver el flujo completo sin navegar entre módulos. En un proyecto de producción, la arquitectura se dividiría en controllers, services y routes separados.

### ¿Por qué generar el PDF manualmente?

El PDF se genera construyendo la estructura binaria del formato PDF 1.4 directamente, sin librerías externas. Esto mantiene el `package.json` minimal y demuestra que se entiende el proceso de generación. La desventaja es que solo soporta texto plano sin imágenes ni estilos complejos.

### ¿Por qué `FOR UPDATE` en la transacción de ventas?

La cláusula `FOR UPDATE` en el `SELECT` del producto bloquea la fila hasta que la transacción termina. Esto evita el problema de dos ventas simultáneas que lean el mismo stock disponible y ambas lo vendan, resultando en stock negativo. Es un ejemplo de control de concurrencia pesimista.

### ¿Por qué `ensureViewExists()` en cada request?

La vista `vista_resumen_ventas` se recrea con `CREATE OR REPLACE VIEW` antes de cada consulta que la usa. Esto garantiza que si la base de datos fue reiniciada y la vista no existe por alguna razón, se recrea automáticamente sin requerir intervención manual.

---

## 11. Conclusiones

- El diseño relacional con 8 tablas y una vista es suficiente para modelar el dominio de una tienda de retail, manteniendo integridad referencial mediante claves foráneas.
- Las consultas SQL implementadas demuestran el uso de las principales herramientas analíticas de PostgreSQL: JOINs de múltiples tablas, subqueries correlacionados, `EXISTS`, `GROUP BY / HAVING`, CTEs con `WITH` y window functions con `ROW_NUMBER()`.
- La transacción de ventas con `FOR UPDATE` y manejo explícito de `ROLLBACK` garantiza que el inventario siempre sea consistente, incluso ante errores en medio de la operación.
- La arquitectura de sesiones con cookie HttpOnly ofrece mejor seguridad que el almacenamiento de tokens en localStorage sin requerir infraestructura adicional.
- Para una versión de producción, las mejoras prioritarias serían: separar el backend en módulos, reemplazar SHA-256 por bcrypt para contraseñas, agregar un healthcheck en Docker para que el backend espere a que PostgreSQL esté listo, y persistir las sesiones en Redis o en la propia base de datos.