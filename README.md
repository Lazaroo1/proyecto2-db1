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
- Contrasena: `secret`

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

Si ya había sido levantado antes y se desea reiniciar todo:

```bash
docker compose down
docker compose up --build
```

## URLs del proyecto

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## Que incluye la aplicacion

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

### 3. Consultas SQL visibles en la UI

El dashboard incluye consultas ejecutadas desde la aplicacion web:

- `JOIN`
- `SUBQUERY`
- `GROUP BY` + `HAVING`
- `CTE (WITH)`
- `VIEW`
- transaccion explicita con `BEGIN / COMMIT / ROLLBACK`

### 4. Transaccion de ventas

La seccion de ventas permite registrar una venta desde la UI. El backend:

1. inserta en `venta`
2. inserta en `detalle_venta`
3. actualiza el stock en `producto`
4. hace `ROLLBACK` si ocurre un error

Se puede probar el rollback intentando vender una cantidad mayor al stock disponible.

## Archivos importantes

- [docker-compose.yml](./docker-compose.yml)
- [db/init.sql](./db/init.sql)
- [db/data.sql](./db/data.sql)
- [backend/index.js](./backend/index.js)
- [frontend/src/App.jsx](./frontend/src/App.jsx)

## Notas de uso

- Si se realizan cambios en backend o frontend, se vuelve a ejecutar `docker compose up --build`.
- Si se cambian scripts de inicializacion SQL y se quiere recargar la base desde cero, usar:

```bash
docker compose down -v
docker compose up --build
```
