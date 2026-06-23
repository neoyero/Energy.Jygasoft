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

INSERT INTO catalogo_equipos (tipo,marca,modelo,potencia_wp,certificacion,precio) VALUES
 ('panel','Jinko/Trina/Risen','Mono TOPCon 600 W',600,'IEC/UL',3500),
 ('panel','Premium','Mono 645 W',645,'IEC/UL',4200),
 ('inversor','Growatt','String 5 kW',NULL,'UL1741/IEEE1547',18000),
 ('inversor','Goodwe','String 8-10 kW',NULL,'UL1741/IEEE1547',30000),
 ('estructura','-','Riel techo (por panel)',NULL,NULL,700),
 ('material_electrico','-','Cable + MC4 + protecciones (por kWp)',NULL,NULL,1500);
