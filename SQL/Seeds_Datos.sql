-- =====================================================================
-- Jygasoft Energy — Seeds de datos (estructura en Esquema_BD_Postgres.sql)
-- Tarifas CFE: Aguascalientes, jun-2026 (fuente: portal CFE app.cfe.mx).
-- Costos: derivados del Estudio de Mercado (USD/W, FX 17.5).
-- =====================================================================
INSERT INTO usuarios (nombre,email,rol,folio_vendedor) VALUES
 ('Sr. Yerandy','yerandy.arias@jygasoft.com','admin',NULL),
 ('Vendedor 01','vendedor01@jygasoft.com','vendedor','Vendedor01'),
 ('Líder Cuadrilla 1','cuadrilla1@jygasoft.com','lider_cuadrilla',NULL);

INSERT INTO hsp_zonas (municipio,estado_mx,hsp,tarifa_default) VALUES
 ('Aguascalientes','Aguascalientes',5.90,'PDBT'),
 ('Jesús María','Aguascalientes',5.90,'1'),
 ('San Francisco de los Romo','Aguascalientes',5.90,'1'),
 ('Calvillo','Aguascalientes',5.95,'1'),
 ('Rincón de Romos','Aguascalientes',5.90,'1'),
 ('Pabellón de Arteaga','Aguascalientes',5.90,'1'),
 ('Asientos','Aguascalientes',5.88,'1'),
 ('Cosío','Aguascalientes',5.88,'1'),
 ('Tepezalá','Aguascalientes',5.88,'1'),
 ('El Llano','Aguascalientes',5.90,'1');

-- HSP promedio por estado (fallback nacional de la calculadora). Valores
-- aproximados; el detalle por municipio vive en hsp_zonas (mayor prioridad).
-- Ver también db/seeds/hsp_estados.sql (UPSERT idempotente).
INSERT INTO hsp_estados (estado_mx, hsp, fuente) VALUES
 ('Aguascalientes',5.90,'aprox.'),('Baja California',5.70,'aprox.'),
 ('Baja California Sur',6.20,'aprox.'),('Campeche',5.30,'aprox.'),
 ('Chiapas',5.00,'aprox.'),('Chihuahua',6.00,'aprox.'),
 ('Ciudad de México',5.30,'aprox.'),('Coahuila de Zaragoza',5.90,'aprox.'),
 ('Colima',5.50,'aprox.'),('Durango',6.00,'aprox.'),
 ('Guanajuato',5.80,'aprox.'),('Guerrero',5.60,'aprox.'),
 ('Hidalgo',5.50,'aprox.'),('Jalisco',5.80,'aprox.'),
 ('México',5.40,'aprox.'),('Michoacán de Ocampo',5.60,'aprox.'),
 ('Morelos',5.60,'aprox.'),('Nayarit',5.50,'aprox.'),
 ('Nuevo León',5.50,'aprox.'),('Oaxaca',5.60,'aprox.'),
 ('Puebla',5.50,'aprox.'),('Querétaro',5.80,'aprox.'),
 ('Quintana Roo',5.30,'aprox.'),('San Luis Potosí',5.80,'aprox.'),
 ('Sinaloa',5.70,'aprox.'),('Sonora',6.30,'aprox.'),
 ('Tabasco',4.80,'aprox.'),('Tamaulipas',5.40,'aprox.'),
 ('Tlaxcala',5.40,'aprox.'),('Veracruz de Ignacio de la Llave',5.00,'aprox.'),
 ('Yucatán',5.40,'aprox.'),('Zacatecas',6.00,'aprox.');

INSERT INTO tarifas_cfe (tarifa,escalon,precio_kwh,cargo_fijo_mxn,region,vigente_desde,fuente) VALUES
 ('1','basico',1.1250,NULL,'Nacional','2026-06-01','CFE app.cfe.mx jun-2026'),
 ('1','intermedio',1.3690,NULL,'Nacional','2026-06-01','CFE app.cfe.mx jun-2026'),
 ('1','excedente',4.0040,NULL,'Nacional','2026-06-01','CFE app.cfe.mx jun-2026'),
 ('DAC','energia',6.7520,144.79,'Central','2026-06-01','CFE app.cfe.mx jun-2026'),
 ('PDBT','variable',3.7710,42.72,'Bajio','2026-06-01','CFE app.cfe.mx jun-2026');

INSERT INTO config_parametros (clave,valor,unidad,descripcion) VALUES
 ('PR',0.77,'-','Factor de desempeño'),
 ('WP_PANEL',600,'W','Potencia por panel (mercado 550-645 W)'),
 ('USD_MXN',17.5,'MXN/USD','Tipo de cambio (estudio de mercado)'),
 ('COSTO_KWP_MIN',14000,'MXN/kWp','aprox 0.80 USD/W — gama media (estudio)'),
 ('COSTO_KWP_MAX',17500,'MXN/kWp','aprox 1.00 USD/W — premium (estudio)'),
 ('PRECIO_KWH_REFERENCIA',4.0040,'MXN/kWh','Excedente Tarifa 1 (rate marginal residencial)'),
 ('PRECIO_KWH_DAC',6.7520,'MXN/kWh','DAC region Central'),
 ('PRECIO_KWH_PDBT',3.7710,'MXN/kWh','PDBT comercial BT (Bajio)'),
 ('IVA',0.16,'-','Tasa general'),
 ('VIDA_UTIL',25,'anios','Vida util estimada');

-- Catálogo unificado: tipos editables + productos con atributos JSON por tipo.
INSERT INTO producto_tipos (nombre,clave,descripcion) VALUES
 ('Panel','panel','Módulos fotovoltaicos'),
 ('Inversor','inversor','Inversores y microinversores'),
 ('Estructura de montaje','estructura','Estructura y soportería'),
 ('Material eléctrico','material_electrico','Cable, conectores y material eléctrico'),
 ('Protecciones','protecciones','Centros de carga, supresores y protecciones'),
 ('Otro','otro','Otros productos')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO productos (producto_tipo_id,nombre,marca,modelo,precio_venta,atributos)
SELECT pt.id, v.nombre, v.marca, v.modelo, v.precio, v.atributos
FROM (VALUES
 ('panel','Jinko/Trina/Risen Mono TOPCon 600 W','Jinko/Trina/Risen','Mono TOPCon 600 W',3500::numeric,'{"potencia_wp":600}'::jsonb),
 ('panel','Premium Mono 645 W','Premium','Mono 645 W',4200,'{"potencia_wp":645}'),
 ('inversor','Growatt String 5 kW','Growatt','String 5 kW',18000,'{}'),
 ('inversor','Goodwe String 8-10 kW','Goodwe','String 8-10 kW',30000,'{}'),
 ('estructura','Riel techo (por panel)','-','Riel techo (por panel)',700,'{}'),
 ('material_electrico','Cable + MC4 + protecciones (por kWp)','-','Cable + MC4 + protecciones (por kWp)',1500,'{}')
) AS v(clave,nombre,marca,modelo,precio,atributos)
JOIN producto_tipos pt ON pt.clave = v.clave;
