# Proyecto 2 DB1

Aplicacion web para gestionar inventario y ventas de una tienda usando:

- `Frontend`: React + Vite
- `Backend`: Node.js + Express
- `Base de datos`: PostgreSQL
- `Infraestructura`: Docker Compose

## Requisitos

- Docker Desktop instalado y ejecutandose
- Git

## Variables de entorno

El proyecto usa las credenciales solicitadas en la rubrica:

- Usuario de base de datos: `proy2`
- Contraseña: `secret`

El repositorio incluye un archivo `.env.example`. Si no tienes `.env`, puedes crearlo con este contenido:

```env
DB_USER=proy2
DB_PASSWORD=secret
DB_NAME=tienda
DB_HOST=db
DB_PORT=5432
PORT=3000
```

## Como levantar el proyecto

Desde la raiz del repositorio ejecutar:

```bash
docker compose up --build
```

Si ya se había levantado antes y se quiere reiniciar todo:

```bash
docker compose down
docker compose up --build
```

Si se cambia la estructura SQL y se quiere reinicializar la base desde cero:

```bash
docker compose down -v
docker compose up --build
```

## URLs del proyecto

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## Credenciales de autenticacion

La aplicacion incluye login/logout con sesión basada en cookie HttpOnly.

Usuarios de prueba:

- `admin` / `tienda2026`
- `ventas` / `tienda2026`
- `inventario` / `tienda2026`

## Funcionalidades principales

### 1. CRUD completo en la interfaz

La interfaz incluye CRUD completo para:

- `cliente`
- `producto`

Cada entidad permite:

- crear
- listar
- editar
- eliminar

Tambien muestra mensajes visibles para:

- validaciones de campos obligatorios
- errores por restricciones de base de datos
- confirmaciones de creacion, actualizacion y eliminacion

### 2. Reporte visible en la UI

La aplicacion muestra un reporte ejecutivo con datos reales de la base:

- total de productos
- total de clientes
- unidades en stock
- ventas del mes actual
- top categorias por ingresos
- ventas recientes

### 3. Exportacion de reporte a PDF

Desde la UI puedes exportar el reporte ejecutivo a PDF con el boton:

- `Exportar reporte a PDF`

El PDF se genera desde el backend y se descarga directamente en el navegador.

### 4. Consultas SQL visibles en la UI

El dashboard incluye consultas ejecutadas desde la aplicacion web:

- `JOIN`
- `SUBQUERY`
- `GROUP BY` + `HAVING`
- `CTE (WITH)`
- `VIEW`
- transaccion explicita con `BEGIN / COMMIT / ROLLBACK`

### 5. Transaccion de ventas

La seccion de ventas permite registrar una venta desde la UI. El backend:

1. inserta en `venta`
2. inserta en `detalle_venta`
3. actualiza el stock en `producto`
4. hace `ROLLBACK` si ocurre un error

Se puede probar el rollback intentando vender una cantidad mayor al stock disponible.

## Flujo recomendado de prueba

1. Iniciar sesion con `admin / tienda2026`
2. Revisar el reporte ejecutivo
3. Exportar el reporte a PDF
4. Crear, editar y eliminar un cliente
5. Crear, editar y eliminar un producto
6. Prueba de una venta valida
7. Prueba de una venta invalida con cantidad mayor al stock para demostrar `ROLLBACK`
8. Revisar las consultas SQL visibles en el dashboard

## Archivos importantes

- [docker-compose.yml](./docker-compose.yml)
- [db/init.sql](./db/init.sql)
- [db/data.sql](./db/data.sql)
- [backend/index.js](./backend/index.js)
- [frontend/src/App.jsx](./frontend/src/App.jsx)

## Notas de uso

- Si se hacen cambios en backend o frontend, vuelve a ejecutar `docker compose up --build`.
- Si el navegador muestra una version anterior de la app, haz un hard refresh con `Ctrl + F5`.
