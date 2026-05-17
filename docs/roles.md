# Esquema de roles

## Permisos por rol

| Rol | Tablas accesibles | Operaciones permitidas | Usuario de prueba |
| --- | --- | --- | --- |
| `rol_admin` | `categoria`, `proveedor`, `producto`, `cliente`, `empleado`, `usuario`, `venta`, `detalle_venta` | `ALL` en todas las tablas | `admin` |
| `rol_ventas` | `producto`, `categoria`, `proveedor`, `venta`, `detalle_venta`, `cliente`, `empleado` | `SELECT` en `producto`, `categoria`, `proveedor`, `cliente`, `empleado`; `SELECT`, `INSERT` en `venta`, `detalle_venta` | `ventas` |
| `rol_inventario` | `producto`, `categoria`, `proveedor`, `venta`, `detalle_venta` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` en `producto`, `categoria`, `proveedor`; `SELECT` en `venta`, `detalle_venta`; `INSERT`, `UPDATE`, `DELETE` revocados en `venta`, `detalle_venta` | `inventario` |
| `rol_cajero` | `producto`, `cliente`, `empleado`, `venta`, `detalle_venta` | `SELECT` en `producto`, `cliente`, `empleado`; `SELECT`, `INSERT` en `venta`, `detalle_venta`; `INSERT`, `UPDATE`, `DELETE` revocados en `producto` | `cajero` |
| `rol_reportes` | `categoria`, `proveedor`, `producto`, `cliente`, `empleado`, `usuario`, `venta`, `detalle_venta` | Solo `SELECT` en todas las tablas | `reportes` |

## Stored Procedures

Las rutinas estan implementadas en `db/init.sql` como funciones PL/pgSQL e invocadas por el backend con `SELECT`.

| Rutina | Descripcion | Parametros | Roles que pueden llamarla desde la app |
| --- | --- | --- | --- |
| `sp_registrar_venta` | Registra una venta, bloquea el producto con `FOR UPDATE`, valida stock, inserta `venta` y `detalle_venta`, y descuenta stock. | `p_cliente_id INT`, `p_empleado_id INT`, `p_producto_id INT`, `p_cantidad INT`; retorna `p_venta_id`, `p_stock_restante` | `rol_admin`, `rol_ventas`, `rol_cajero` |
| `sp_crear_producto` | Crea un producto y devuelve su id. Valida precio positivo y stock no negativo. | `p_nombre VARCHAR`, `p_precio DECIMAL`, `p_stock INT`, `p_id_categoria INT`, `p_id_proveedor INT`; retorna `p_id_producto` | `rol_admin`, `rol_inventario` |
| `sp_actualizar_stock` | Actualiza el stock de un producto. Valida producto existente y stock no negativo. | `p_id_producto INT`, `p_nuevo_stock INT` | `rol_admin`, `rol_inventario` |
| `sp_crear_cliente` | Crea un cliente y devuelve su id. Valida que el email no venga vacio. | `p_nombre VARCHAR`, `p_apellido VARCHAR`, `p_email VARCHAR`, `p_telefono VARCHAR`; retorna `p_id_cliente` | `rol_admin`, `rol_ventas` |
| `sp_reporte_ventas_mes` | Devuelve ventas por cliente, empleado, total y fecha para un mes especifico. | `p_year INT`, `p_month INT`; retorna `cliente`, `empleado`, `total_venta`, `fecha` | `rol_admin`, `rol_reportes`, `rol_ventas`, `rol_inventario`, `rol_cajero` |

## UI por rol

- `rol_admin`: ve el reporte ejecutivo con exportacion PDF, gestion de clientes con eliminar, gestion de productos con eliminar, registro de venta y dashboard SQL.
- `rol_ventas`: ve el reporte ejecutivo con exportacion PDF, gestion de clientes sin eliminar, registro de venta y dashboard SQL.
- `rol_inventario`: ve gestion de productos sin eliminar y dashboard SQL.
- `rol_cajero`: ve registro de venta y dashboard SQL.
- `rol_reportes`: ve el reporte ejecutivo con exportacion PDF y dashboard SQL.

El panel principal, la informacion de sesion y el boton de cerrar sesion son visibles para todos los usuarios autenticados.
