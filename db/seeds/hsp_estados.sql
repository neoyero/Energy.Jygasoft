-- =====================================================================
-- HSP (horas sol pico) promedio anual por estado — 32 entidades.
-- Nombres de estado: forma oficial SEPOMEX (deben coincidir con
-- codigos_postales.d_estado para que la calculadora los resuelva por CP).
-- Valores aproximados (kWh/m²/día, promedio anual). Refinar con NASA POWER /
-- Global Solar Atlas cuando se tenga el dato puntual por proyecto.
-- Idempotente: UPSERT.
-- =====================================================================
INSERT INTO hsp_estados (estado_mx, hsp, fuente) VALUES
 ('Aguascalientes',                    5.90, 'aprox. promedio anual'),
 ('Baja California',                   5.70, 'aprox. promedio anual'),
 ('Baja California Sur',               6.20, 'aprox. promedio anual'),
 ('Campeche',                          5.30, 'aprox. promedio anual'),
 ('Chiapas',                           5.00, 'aprox. promedio anual'),
 ('Chihuahua',                         6.00, 'aprox. promedio anual'),
 ('Ciudad de México',                  5.30, 'aprox. promedio anual'),
 ('Coahuila de Zaragoza',              5.90, 'aprox. promedio anual'),
 ('Colima',                            5.50, 'aprox. promedio anual'),
 ('Durango',                           6.00, 'aprox. promedio anual'),
 ('Guanajuato',                        5.80, 'aprox. promedio anual'),
 ('Guerrero',                          5.60, 'aprox. promedio anual'),
 ('Hidalgo',                           5.50, 'aprox. promedio anual'),
 ('Jalisco',                           5.80, 'aprox. promedio anual'),
 ('México',                            5.40, 'aprox. promedio anual'),
 ('Michoacán de Ocampo',               5.60, 'aprox. promedio anual'),
 ('Morelos',                           5.60, 'aprox. promedio anual'),
 ('Nayarit',                           5.50, 'aprox. promedio anual'),
 ('Nuevo León',                        5.50, 'aprox. promedio anual'),
 ('Oaxaca',                            5.60, 'aprox. promedio anual'),
 ('Puebla',                            5.50, 'aprox. promedio anual'),
 ('Querétaro',                         5.80, 'aprox. promedio anual'),
 ('Quintana Roo',                      5.30, 'aprox. promedio anual'),
 ('San Luis Potosí',                   5.80, 'aprox. promedio anual'),
 ('Sinaloa',                           5.70, 'aprox. promedio anual'),
 ('Sonora',                            6.30, 'aprox. promedio anual'),
 ('Tabasco',                           4.80, 'aprox. promedio anual'),
 ('Tamaulipas',                        5.40, 'aprox. promedio anual'),
 ('Tlaxcala',                          5.40, 'aprox. promedio anual'),
 ('Veracruz de Ignacio de la Llave',   5.00, 'aprox. promedio anual'),
 ('Yucatán',                           5.40, 'aprox. promedio anual'),
 ('Zacatecas',                         6.00, 'aprox. promedio anual')
ON CONFLICT (estado_mx) DO UPDATE
  SET hsp = EXCLUDED.hsp, fuente = EXCLUDED.fuente;
