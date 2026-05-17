# OmniMarket — Proyecto 3 DB1

Sistema web para gestionar inventario y ventas de una tienda de retail general, desarrollado para el curso de Bases de Datos 1.

- **Estudiante:** Lázaro Díaz — 24713
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL 15
- **Infraestructura:** Docker Compose

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y ejecutándose
- Git

No se necesita tener Node.js ni PostgreSQL instalados localmente.

---

## Levantar el proyecto

### Primera vez

```bash
git clone https://github.com/Lazaroo1/proyecto2-db1
cd proyecto2-db1
cp .env.example .env
docker compose up --build
```

### Reinicio normal (sin borrar datos)

```bash
docker compose down
docker compose up --build
```

### Reinicio completo (borra la base de datos)

Usar este comando si se modificó `db/init.sql`, los procedimientos almacenados definidos allí o `db/data.sql`:

```bash
docker compose down -v
docker compose up --build
```

---

## Variables de entorno

El proyecto usa las credenciales requeridas por la rúbrica. El archivo `.env.example` incluido contiene:

```env
DB_USER=proy3
DB_PASSWORD=secret
DB_NAME=tienda
DB_HOST=db
DB_PORT=5432
PORT=3000
```

> **Nota:** Las credenciales `proy3` / `secret` están fijadas según los requisitos del proyecto.

---

## URLs

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |

---

## Credenciales de prueba

La aplicación incluye autenticación con sesión basada en **cookie HttpOnly**.

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `tienda2026` | Administrador general |
| `ventas` | `tienda2026` | Supervisor de ventas |
| `inventario` | `tienda2026` | Coordinación de inventario |
| `cajero` | `tienda2026` | Cajero de prueba |
| `reportes` | `tienda2026` | Analista de reportes |

---

## Estructura del proyecto

```
.
├── backend/
│   ├── index.js          # Servidor Express, rutas y lógica de negocio
│   ├── package.json
│   └── Dockerfile
├── db/
│   ├── init.sql          # DDL: tablas, vista, índices
│   └── data.sql          # Datos de prueba (25+ registros por tabla)
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Componente principal con toda la UI
│   │   └── App.css       # Estilos
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── docs/
    └── documentation.md  # Documentación técnica completa
```

---

## Funcionalidades

### Proyecto 3 — Nuevas funcionalidades

- Prisma ORM configurado junto al `pg Pool` existente.
- 5 stored procedures/funciones PL/pgSQL para ventas, productos, clientes, stock y reportes mensuales.
- 5 roles de base de datos: `rol_admin`, `rol_ventas`, `rol_inventario`, `rol_cajero`, `rol_reportes`.
- Interfaz con visibilidad por rol para reportes, clientes, productos, ventas y acciones de eliminación.

### CRUD de entidades

La interfaz incluye CRUD completo para **clientes** y **productos**, con:

- Formularios de creación y edición
- Listado en tabla
- Botones de editar y eliminar por fila
- Mensajes de error visibles para validaciones y restricciones de base de datos
- Confirmaciones de operaciones exitosas

### Reporte ejecutivo

Panel con métricas reales de la base de datos:

- Total de productos activos
- Total de clientes registrados
- Unidades en stock
- Ventas acumuladas del mes actual
- Top 5 categorías por ingresos
- 5 ventas más recientes

### Exportación a PDF

El reporte ejecutivo se puede descargar como PDF desde el botón **"Exportar reporte a PDF"**. El archivo se genera en el backend y se descarga directamente en el navegador.

### Consultas SQL visibles en la UI

El dashboard muestra 8 consultas ejecutadas en tiempo real desde la aplicación:

| Categoría | Consulta |
|---|---|
| JOIN | Inventario por categoría y proveedor |
| JOIN | Detalle de ventas recientes |
| JOIN | Ventas por empleado |
| SUBQUERY | Productos sobre el promedio de su categoría |
| SUBQUERY | Clientes con compras altas (EXISTS) |
| GROUP BY + HAVING | Ingresos por categoría |
| CTE | Cliente top por mes (WITH + ROW_NUMBER) |
| VIEW | Resumen de ventas desde `vista_resumen_ventas` |

### Transacción de ventas con ROLLBACK

La sección de ventas registra una transacción completa que:

1. Hace `BEGIN`
2. Inserta en `venta`
3. Inserta en `detalle_venta`
4. Descuenta el stock en `producto`
5. Hace `COMMIT` si todo fue exitoso
6. Hace `ROLLBACK` automático si ocurre cualquier error

**Para probar el ROLLBACK:** intentar vender una cantidad mayor al stock disponible. El backend rechaza la operación y revierte todo.

---

## Flujo recomendado para evaluación

1. Ejecutar `docker compose up --build`
2. Abrir http://localhost:5173
3. Iniciar sesión con `admin / tienda2026`
4. Revisar el **reporte ejecutivo** con métricas reales
5. Exportar el reporte a **PDF**
6. En **Gestión de clientes**: crear, editar y eliminar un cliente
7. En **Gestión de productos**: crear, editar y eliminar un producto
8. En **Registrar venta**: hacer una venta válida (cantidad menor al stock)
9. En **Registrar venta**: intentar una cantidad mayor al stock para ver el **ROLLBACK**
10. Bajar al **dashboard SQL** y revisar las 8 consultas con sus resultados

---

## Archivos clave

| Archivo | Descripción |
|---|---|
| `docker-compose.yml` | Definición de los tres servicios |
| `db/init.sql` | DDL completo: tablas, vista, índices |
| `db/data.sql` | Datos de prueba realistas |
| `backend/index.js` | API REST, autenticación, queries SQL |
| `frontend/src/App.jsx` | Interfaz completa en React |
| `docs/documentacion.md` | Documentación técnica del proyecto |

---

## Notas adicionales

- Si el navegador muestra una versión anterior de la app, hacer **hard refresh** con `Ctrl + Shift + R`.
- Si el backend falla al arrancar por conexión a la DB, esperar unos segundos y ejecutar `docker compose restart backend`.
- Los datos de prueba se cargan automáticamente al levantar por primera vez. Si se quiere restaurar el estado inicial, usar `docker compose down -v`.
