-- Datos locales de demostración para el panel React.
-- Este archivo se ejecuta desde scripts/dev-all.mjs después de que Flyway haya creado el esquema.

DO $$
BEGIN
    IF current_database() !~* '(demo|poc|local|test)' THEN
        RAISE EXCEPTION
            'Seed demo bloqueado en la base "%". Usa una base local con demo/poc/local/test en el nombre.',
            current_database();
    END IF;
END $$;

TRUNCATE TABLE
    inscripciones,
    alumno_forma,
    grado_forma,
    instructor_estilo,
    cursos_agendados,
    cursos,
    alumnos,
    administradores,
    instructores,
    formas,
    grados,
    estilos
RESTART IDENTITY CASCADE;

INSERT INTO estilos (id_estilo, nombre, descripcion) VALUES
    (1, 'Ving Tsun', 'Sistema directo de corta distancia y economía de movimiento.'),
    (2, 'Hung Gar', 'Trabajo de posiciones, potencia y formas tradicionales del sur.'),
    (3, 'Choy Li Fut', 'Estilo amplio, circular y muy dinámico.'),
    (4, 'Tai Chi Chuan', 'Trabajo interno, estructura corporal y continuidad.'),
    (5, 'Pa Kua Chang', 'Desplazamientos circulares, cambios de palma y estrategia.'),
    (6, 'Xing-I Chuan', 'Sistema interno lineal basado en intención y cinco elementos.'),
    (7, 'Shaolin', 'Base tradicional de coordinación, fuerza y formas clásicas.');

INSERT INTO formas (id_forma, id_estilo, nombre, descripcion) VALUES
    (1, 1, 'Siu Nim Tao', 'Primera forma de Ving Tsun.'),
    (2, 1, 'Chum Kiu', 'Puentes, giros y coordinación del cuerpo.'),
    (3, 1, 'Biu Jee', 'Recuperación de línea y acciones de emergencia.'),
    (4, 1, 'Muk Yan Jong', 'Forma del muñeco de madera.'),
    (5, 1, 'Luk Dim Boon Gwun', 'Palo largo de seis puntos y medio.'),
    (6, 2, 'Gung Gee Fook Fu Kuen', 'Domar al tigre en patrón Gung.'),
    (7, 2, 'Fu Hok Seung Ying Kuen', 'Forma del tigre y la grulla.'),
    (8, 2, 'Sup Ying Kuen', 'Diez animales.'),
    (9, 2, 'Tid Sin Kuen', 'Alambre de hierro.'),
    (10, 2, 'Mui Fa Kuen', 'Forma de flor de ciruelo.'),
    (11, 3, 'Siu Mui Fa Kuen', 'Pequeña flor de ciruelo.'),
    (12, 3, 'Ping Kuen', 'Forma de puño plano.'),
    (13, 3, 'Kau Da Kuen', 'Combinaciones de ataque y defensa.'),
    (14, 3, 'Sap Ji Kau Da', 'Diez caracteres de combate.'),
    (15, 3, 'Che Kuen', 'Forma de giro y continuidad.'),
    (16, 4, '24 Yang', 'Secuencia simplificada estilo Yang.'),
    (17, 4, '108 Yang', 'Forma larga tradicional Yang.'),
    (18, 4, 'Tui Shou Básico', 'Empuje de manos básico.'),
    (19, 4, 'Espada Yang', 'Trabajo básico de espada recta.'),
    (20, 4, 'Chen Lao Jia', 'Estructura tradicional Chen.'),
    (21, 5, 'Cambio Simple de Palma', 'Base de cambio y caminar circular.'),
    (22, 5, 'Ocho Cambios de Palma', 'Cambios principales de Pa Kua.'),
    (23, 5, 'León', 'Cambio asociado al trigrama Qian.'),
    (24, 5, 'Serpiente', 'Cambio asociado a desplazamiento bajo.'),
    (25, 5, 'Dragón', 'Cambio con espiral y envolvente.'),
    (26, 6, 'Pi Quan', 'Elemento metal.'),
    (27, 6, 'Zuan Quan', 'Elemento agua.'),
    (28, 6, 'Beng Quan', 'Elemento madera.'),
    (29, 6, 'Pao Quan', 'Elemento fuego.'),
    (30, 6, 'Heng Quan', 'Elemento tierra.'),
    (31, 7, 'Lian Bu Quan', 'Forma de pasos enlazados.'),
    (32, 7, 'Gong Li Quan', 'Trabajo de fuerza básica.'),
    (33, 7, 'Xiao Hong Quan', 'Pequeño puño rojo.'),
    (34, 7, 'Da Hong Quan', 'Gran puño rojo.'),
    (35, 7, 'Tong Bei Quan', 'Trabajo de espalda y brazos largos.'),
    (36, 1, 'Chi Sao Básico', 'Sensibilidad inicial de brazos pegajosos.'),
    (37, 2, 'Puente de Hierro', 'Ejercicio técnico de estructura.'),
    (38, 3, 'Bakwa Kuen', 'Secuencia circular complementaria.'),
    (39, 4, 'Abanico de Tai Chi', 'Forma suave con abanico.'),
    (40, 5, 'Caminar el Círculo', 'Base continua de desplazamiento.');

INSERT INTO grados (id_grado, nombre, orden_grado, color_cinturon, formas_requeridas) VALUES
    (1, 'Cinta Blanca', 1, 'Blanco', 1),
    (2, 'Cinta Amarilla', 2, 'Amarillo', 2),
    (3, 'Cinta Naranja', 3, 'Naranja', 3),
    (4, 'Cinta Verde', 4, 'Verde', 5),
    (5, 'Cinta Azul', 5, 'Azul', 7),
    (6, 'Cinta Marrón', 6, 'Marrón', 10),
    (7, 'Cinta Negra 1º Duan', 7, 'Negro', 14),
    (8, 'Cinta Negra 2º Duan', 8, 'Negro', 18),
    (9, 'Cinta Negra 3º Duan', 9, 'Negro', 22),
    (10, 'Cinta Negra 4º Duan', 10, 'Negro', 28),
    (11, 'Cinta Negra 5º Duan', 11, 'Negro', 34);

INSERT INTO grado_forma (id_grado, id_forma, es_opcional)
SELECT
    g.id_grado,
    f.id_forma,
    f.id_forma > GREATEST(2, g.orden_grado * 3)
FROM grados g
JOIN formas f ON f.id_forma <= LEAST(40, 2 + g.orden_grado * 4);

INSERT INTO administradores (id_administrador, fecha_inicio, nombre, password_hash, correo_electronico) VALUES
    (1, '2024-01-01', 'Administrador Demo', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK', 'admin.demo@iwushu.local');

INSERT INTO instructores (id_instructor, fecha_contratacion, activo, especialidad, nombre, correo_electronico, password_hash) VALUES
    (1, '2016-09-01', TRUE, 'Ving Tsun', 'Bruno Ferrer Roca', 'bruno.ferrer@iwushu.local', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK'),
    (2, '2018-01-15', TRUE, 'Hung Gar', 'Ana Domènech Pérez', 'ana.domenech@iwushu.local', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK'),
    (3, '2019-03-10', TRUE, 'Pa Kua Chang', 'Álvaro Costa Marín', 'alvaro.costa@iwushu.local', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK'),
    (4, '2020-10-05', TRUE, 'Tai Chi Chuan', 'Mei Lin Serrano', 'mei.lin@iwushu.local', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK'),
    (5, '2021-02-22', TRUE, 'Choy Li Fut', 'Marc Vidal Sunyer', 'marc.vidal@iwushu.local', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK'),
    (6, '2022-05-12', TRUE, 'Xing-I Chuan', 'Laura Chen Ruiz', 'laura.chen@iwushu.local', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK'),
    (7, '2023-09-18', FALSE, 'Shaolin', 'Jordi Prats Molina', 'jordi.prats@iwushu.local', '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK');

INSERT INTO instructor_estilo (id_instructor, id_estilo) VALUES
    (1, 1), (1, 5),
    (2, 2), (2, 4),
    (3, 5), (3, 7),
    (4, 4),
    (5, 3), (5, 6),
    (6, 6), (6, 1),
    (7, 7);

INSERT INTO cursos (id_curso, nombre, tema, descripcion) VALUES
    (1, 'Clase regular', 'Fundamentos de Ving Tsun', 'Trabajo de base, estructura y sensibilidad.'),
    (2, 'Clase técnica', 'Aplicaciones de Pa Kua Chang', 'Cambios de palma y desplazamientos.'),
    (3, 'Práctica guiada', 'Entrenamiento técnico de Hung Gar', 'Posiciones, respiración y potencia.'),
    (4, 'Intensivo', 'Aplicaciones de Choy Li Fut', 'Trabajo circular y combinaciones.'),
    (5, 'Seminario', 'Introducción a Xing-I Chuan', 'Cinco elementos y líneas de fuerza.'),
    (6, 'Clase suave', 'Tai Chi Chuan para estructura', 'Continuidad, alineación y calma.'),
    (7, 'Repaso de formas', 'Programa de grados medios', 'Revisión por grupos de cinturón.'),
    (8, 'Clase de armas', 'Palo largo y espada', 'Bases de seguridad y coordinación.'),
    (9, 'Preparación examen', 'Cinturones amarillos y verdes', 'Simulación de prueba técnica.'),
    (10, 'Clase abierta', 'Puertas abiertas', 'Sesión introductoria para nuevos alumnos.'),
    (11, 'Trabajo interno', 'Respiración y raíz', 'Sesión tranquila de estructura interna.'),
    (12, 'Sábado técnico', 'Formas clásicas', 'Bloque largo de entrenamiento del fin de semana.');

INSERT INTO cursos_agendados (id_curso_agendado, id_curso, id_instructor, fecha_hora, activo) VALUES
    (1, 1, 1, (CURRENT_DATE + 1) + TIME '19:00', TRUE),
    (2, 2, 3, (CURRENT_DATE + 2) + TIME '19:30', TRUE),
    (3, 3, 2, (CURRENT_DATE + 3) + TIME '18:30', TRUE),
    (4, 4, 5, (CURRENT_DATE + 4) + TIME '10:30', TRUE),
    (5, 5, 6, (CURRENT_DATE + 5) + TIME '11:00', TRUE),
    (6, 6, 4, (CURRENT_DATE + 6) + TIME '18:00', TRUE),
    (7, 7, 1, (CURRENT_DATE + 7) + TIME '20:00', TRUE),
    (8, 8, 2, (CURRENT_DATE + 8) + TIME '10:00', TRUE),
    (9, 9, 5, (CURRENT_DATE + 9) + TIME '18:30', TRUE),
    (10, 10, 3, (CURRENT_DATE + 10) + TIME '12:00', TRUE),
    (11, 11, 4, (CURRENT_DATE + 11) + TIME '19:00', TRUE),
    (12, 12, 7, (CURRENT_DATE + 12) + TIME '10:00', FALSE),
    (13, 1, 1, (CURRENT_DATE - 2) + TIME '19:00', TRUE),
    (14, 3, 2, (CURRENT_DATE - 5) + TIME '18:30', TRUE),
    (15, 6, 4, (CURRENT_DATE - 8) + TIME '18:00', TRUE),
    (16, 9, 5, (CURRENT_DATE + 14) + TIME '18:30', TRUE);

INSERT INTO alumnos (id_alumno, numero_matricula, fecha_ingreso, activo, nombre, fecha_nacimiento, correo_electronico, id_grado, password_hash) VALUES
    (1, 'IW-2026-001', '2024-09-10', TRUE, 'Adriana Álvarez Benet', '1991-04-18', 'adriana.alvarez@example.com', 5, NULL),
    (2, 'IW-2026-002', '2023-10-02', TRUE, 'Alejandro Blanch Castro', '1988-02-22', 'alejandro.blanch@example.com', 4, NULL),
    (3, 'IW-2026-003', '2025-01-12', TRUE, 'Alicia Chen Flores', '1997-11-03', 'alicia.chen@example.com', 3, NULL),
    (4, 'IW-2026-004', '2022-05-18', TRUE, 'Álvaro Costa Marín', '1984-07-09', 'alvaro.costa@example.com', 7, NULL),
    (5, 'IW-2026-005', '2025-09-03', TRUE, 'Berta Delgado Puig', '2001-01-28', 'berta.delgado@example.com', 2, NULL),
    (6, 'IW-2026-006', '2024-02-20', TRUE, 'Bruno Ferrer Roca', '1990-12-12', 'bruno.ferrer.alumno@example.com', 6, NULL),
    (7, 'IW-2026-007', '2023-04-15', TRUE, 'Carla García Vidal', '1993-05-20', 'carla.garcia@example.com', 4, NULL),
    (8, 'IW-2026-008', '2025-11-07', TRUE, 'Daniel Huang Solé', '2002-08-01', 'daniel.huang@example.com', 2, NULL),
    (9, 'IW-2026-009', '2024-06-25', TRUE, 'Elena Ibáñez Serra', '1996-03-14', 'elena.ibanez@example.com', 5, NULL),
    (10, 'IW-2026-010', '2021-09-14', TRUE, 'Ferran Jiménez Torres', '1981-09-30', 'ferran.jimenez@example.com', 8, NULL),
    (11, 'IW-2026-011', '2026-01-10', TRUE, 'Gemma Li Martí', '1999-10-11', 'gemma.li@example.com', 1, NULL),
    (12, 'IW-2026-012', '2023-12-01', TRUE, 'Hugo Martínez León', '1995-06-06', 'hugo.martinez@example.com', 4, NULL),
    (13, 'IW-2026-013', '2024-11-21', TRUE, 'Irene Navarro Gil', '1992-12-27', 'irene.navarro@example.com', 3, NULL),
    (14, 'IW-2026-014', '2022-01-19', TRUE, 'Jan Ortega Camps', '1987-04-04', 'jan.ortega@example.com', 7, NULL),
    (15, 'IW-2026-015', '2025-05-30', TRUE, 'Laia Pérez Molina', '2000-02-17', 'laia.perez@example.com', 2, NULL),
    (16, 'IW-2026-016', '2020-03-08', TRUE, 'Marc Quesada Font', '1979-08-26', 'marc.quesada@example.com', 9, NULL),
    (17, 'IW-2026-017', '2024-07-12', TRUE, 'Nora Ruiz Casas', '1998-01-05', 'nora.ruiz@example.com', 5, NULL),
    (18, 'IW-2026-018', '2025-02-16', TRUE, 'Oriol Sánchez Roig', '1994-07-21', 'oriol.sanchez@example.com', 3, NULL),
    (19, 'IW-2026-019', '2023-08-28', TRUE, 'Paula Tan Rovira', '1991-09-18', 'paula.tan@example.com', 6, NULL),
    (20, 'IW-2026-020', '2026-02-03', TRUE, 'Quim Ugarte Mas', '2003-05-02', 'quim.ugarte@example.com', 1, NULL),
    (21, 'IW-2026-021', '2022-10-11', TRUE, 'Raquel Vidal Homs', '1986-11-24', 'raquel.vidal@example.com', 7, NULL),
    (22, 'IW-2026-022', '2024-01-27', TRUE, 'Sergi Wang Duran', '1997-03-09', 'sergi.wang@example.com', 5, NULL),
    (23, 'IW-2026-023', '2025-06-18', TRUE, 'Tània Xifre Llop', '2001-06-15', 'tania.xifre@example.com', 2, NULL),
    (24, 'IW-2026-024', '2021-11-06', TRUE, 'Víctor Yang Esteve', '1983-10-29', 'victor.yang@example.com', 8, NULL),
    (25, 'IW-2026-025', '2024-03-05', TRUE, 'Marta Zamora Pons', '1990-01-19', 'marta.zamora@example.com', 4, NULL),
    (26, 'IW-2026-026', '2023-06-13', TRUE, 'Pol Aguilar Rius', '1996-08-10', 'pol.aguilar@example.com', 6, NULL),
    (27, 'IW-2026-027', '2025-03-22', TRUE, 'Clara Bao Ferré', '2002-12-02', 'clara.bao@example.com', 3, NULL),
    (28, 'IW-2026-028', '2022-12-09', TRUE, 'David Campos Grau', '1989-06-07', 'david.campos@example.com', 7, NULL),
    (29, 'IW-2026-029', '2026-01-21', TRUE, 'Eva Domínguez Pla', '2004-04-12', 'eva.dominguez@example.com', 1, NULL),
    (30, 'IW-2026-030', '2024-10-04', TRUE, 'Nil Estrada Sun', '1998-07-16', 'nil.estrada@example.com', 4, NULL),
    (31, 'IW-2026-031', '2023-02-17', TRUE, 'Sara Flores Qin', '1992-02-08', 'sara.flores@example.com', 6, NULL),
    (32, 'IW-2026-032', '2025-12-14', TRUE, 'Joan Gomis Ferrer', '2000-09-21', 'joan.gomis@example.com', 2, NULL),
    (33, 'IW-2026-033', '2021-04-23', TRUE, 'Mariona Herrera Gil', '1985-03-25', 'mariona.herrera@example.com', 9, NULL),
    (34, 'IW-2026-034', '2024-05-19', TRUE, 'Leo Isern Puig', '1999-05-17', 'leo.isern@example.com', 5, NULL),
    (35, 'IW-2026-035', '2022-08-02', FALSE, 'Ona Julià Camps', '1993-12-04', 'ona.julia@example.com', 6, NULL),
    (36, 'IW-2026-036', '2020-09-16', FALSE, 'Pau Kim Navarro', '1982-01-31', 'pau.kim@example.com', 10, NULL);

INSERT INTO alumno_forma (id_alumno, id_forma, fecha_aprendida)
SELECT
    a.id_alumno,
    f.id_forma,
    CURRENT_DATE - ((a.id_alumno * 7 + f.id_forma * 3) % 720)::int
FROM alumnos a
JOIN formas f ON f.id_forma <= LEAST(40, 2 + a.id_grado * 4)
WHERE a.activo = TRUE
  AND NOT (a.id_alumno % 4 = 0 AND f.id_forma % 5 = 0);

INSERT INTO inscripciones (id_alumno, id_curso_agendado, fecha_inscripcion, estado)
SELECT
    a.id_alumno,
    ca.id_curso_agendado,
    CURRENT_DATE - ((a.id_alumno + ca.id_curso_agendado) % 21)::int,
    CASE
        WHEN (a.id_alumno + ca.id_curso_agendado) % 17 = 0 THEN 'suspendida'
        WHEN (a.id_alumno + ca.id_curso_agendado) % 13 = 0 THEN 'inactiva'
        ELSE 'activa'
    END
FROM alumnos a
JOIN cursos_agendados ca ON ca.activo = TRUE
WHERE a.activo = TRUE
  AND (a.id_alumno + ca.id_curso_agendado) % 4 = 0;

SELECT setval(pg_get_serial_sequence('estilos', 'id_estilo'), (SELECT MAX(id_estilo) FROM estilos), TRUE);
SELECT setval(pg_get_serial_sequence('formas', 'id_forma'), (SELECT MAX(id_forma) FROM formas), TRUE);
SELECT setval(pg_get_serial_sequence('grados', 'id_grado'), (SELECT MAX(id_grado) FROM grados), TRUE);
SELECT setval(pg_get_serial_sequence('administradores', 'id_administrador'), (SELECT MAX(id_administrador) FROM administradores), TRUE);
SELECT setval(pg_get_serial_sequence('instructores', 'id_instructor'), (SELECT MAX(id_instructor) FROM instructores), TRUE);
SELECT setval(pg_get_serial_sequence('alumnos', 'id_alumno'), (SELECT MAX(id_alumno) FROM alumnos), TRUE);
SELECT setval(pg_get_serial_sequence('cursos', 'id_curso'), (SELECT MAX(id_curso) FROM cursos), TRUE);
SELECT setval(pg_get_serial_sequence('cursos_agendados', 'id_curso_agendado'), (SELECT MAX(id_curso_agendado) FROM cursos_agendados), TRUE);
SELECT setval(pg_get_serial_sequence('inscripciones', 'id_inscripcion'), (SELECT MAX(id_inscripcion) FROM inscripciones), TRUE);
