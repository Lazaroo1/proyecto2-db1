-- CATEGORIA
CREATE TABLE categoria (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

-- PROVEEDOR
CREATE TABLE proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT
);

-- PRODUCTO
CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL,
    id_categoria INT NOT NULL,
    id_proveedor INT NOT NULL,
    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria),
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)
);

-- CLIENTE
CREATE TABLE cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20)
);

-- EMPLEADO
CREATE TABLE empleado (
    id_empleado SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    cargo VARCHAR(50),
    salario DECIMAL(10,2)
);

-- USUARIO
CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(64) NOT NULL,
    nombre_mostrar VARCHAR(120) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'rol_reportes',
    id_empleado INT,
    FOREIGN KEY (id_empleado) REFERENCES empleado(id_empleado)
);

-- VENTA
CREATE TABLE venta (
    id_venta SERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_cliente INT NOT NULL,
    id_empleado INT NOT NULL,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_empleado) REFERENCES empleado(id_empleado)
);

-- DETALLE VENTA
CREATE TABLE detalle_venta (
    id_detalle SERIAL PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES venta(id_venta),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

-- ROLES DE BASE DE DATOS
CREATE ROLE rol_admin;
CREATE ROLE rol_ventas;
CREATE ROLE rol_inventario;
CREATE ROLE rol_cajero;
CREATE ROLE rol_reportes;

-- PERMISOS: ADMIN
GRANT ALL ON TABLE categoria TO rol_admin;
GRANT ALL ON TABLE proveedor TO rol_admin;
GRANT ALL ON TABLE producto TO rol_admin;
GRANT ALL ON TABLE cliente TO rol_admin;
GRANT ALL ON TABLE empleado TO rol_admin;
GRANT ALL ON TABLE usuario TO rol_admin;
GRANT ALL ON TABLE venta TO rol_admin;
GRANT ALL ON TABLE detalle_venta TO rol_admin;
-- GRANT EXECUTE ON PROCEDURE ... TO rol_admin;

-- PERMISOS: VENTAS
REVOKE ALL ON TABLE categoria, proveedor, producto, cliente, empleado, usuario, venta, detalle_venta FROM rol_ventas;
GRANT SELECT ON TABLE producto TO rol_ventas;
GRANT SELECT ON TABLE categoria TO rol_ventas;
GRANT SELECT ON TABLE proveedor TO rol_ventas;
GRANT SELECT, INSERT ON TABLE venta TO rol_ventas;
GRANT SELECT, INSERT ON TABLE detalle_venta TO rol_ventas;
GRANT SELECT ON TABLE cliente TO rol_ventas;
GRANT SELECT ON TABLE empleado TO rol_ventas;

-- PERMISOS: INVENTARIO
REVOKE ALL ON TABLE categoria, proveedor, producto, cliente, empleado, usuario, venta, detalle_venta FROM rol_inventario;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE producto TO rol_inventario;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE categoria TO rol_inventario;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE proveedor TO rol_inventario;
GRANT SELECT ON TABLE venta TO rol_inventario;
GRANT SELECT ON TABLE detalle_venta TO rol_inventario;
REVOKE INSERT, UPDATE, DELETE ON TABLE venta FROM rol_inventario;
REVOKE INSERT, UPDATE, DELETE ON TABLE detalle_venta FROM rol_inventario;

-- PERMISOS: CAJERO
REVOKE ALL ON TABLE categoria, proveedor, producto, cliente, empleado, usuario, venta, detalle_venta FROM rol_cajero;
GRANT SELECT ON TABLE producto TO rol_cajero;
GRANT SELECT ON TABLE cliente TO rol_cajero;
GRANT SELECT ON TABLE empleado TO rol_cajero;
GRANT SELECT, INSERT ON TABLE venta TO rol_cajero;
GRANT SELECT, INSERT ON TABLE detalle_venta TO rol_cajero;
REVOKE INSERT, UPDATE, DELETE ON TABLE producto FROM rol_cajero;

-- PERMISOS: REPORTES
REVOKE ALL ON TABLE categoria, proveedor, producto, cliente, empleado, usuario, venta, detalle_venta FROM rol_reportes;
GRANT SELECT ON TABLE categoria TO rol_reportes;
GRANT SELECT ON TABLE proveedor TO rol_reportes;
GRANT SELECT ON TABLE producto TO rol_reportes;
GRANT SELECT ON TABLE cliente TO rol_reportes;
GRANT SELECT ON TABLE empleado TO rol_reportes;
GRANT SELECT ON TABLE usuario TO rol_reportes;
GRANT SELECT ON TABLE venta TO rol_reportes;
GRANT SELECT ON TABLE detalle_venta TO rol_reportes;

-- VIEW PARA LA UI DE RESUMEN DE VENTAS
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

-- INDICES EXPLICITOS
CREATE INDEX idx_producto_id_categoria ON producto(id_categoria);
CREATE INDEX idx_venta_fecha ON venta(fecha);
CREATE INDEX idx_detalle_venta_id_venta ON detalle_venta(id_venta);
