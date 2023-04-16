CREATE DATABASE HubGames;

USE HubGames;

CREATE TABLE Usuarios (
  id_usuario INT PRIMARY KEY AUTO_INCREMENT,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT CHECK (cuenta_google = false OR password = ''),
  email_verificado BOOLEAN NOT NULL,
  fecha_creacion TEXT NOT NULL,
  cuenta_google BOOLEAN NOT NULL,
  administrador BOOLEAN NOT NULL
);

CREATE TABLE Reviews (
  id_review INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT,
  encabezado TEXT NOT NULL,
  contenido TEXT NOT NULL,
  valoracion INT NOT NULL CHECK (valoracion >= 1 AND valoracion <= 5),
  fecha_creacion TEXT NOT NULL,
  id_videojuego INT,
  CONSTRAINT fk_reviews_id_usuario
      FOREIGN KEY (id_usuario)
      REFERENCES Usuarios(id_usuario) ON UPDATE CASCADE
);

CREATE TABLE Chats (
  id_chat INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  fecha_creacion TEXT NOT NULL,
  CONSTRAINT fk_chats_id_usuario
      FOREIGN KEY (id_usuario)
      REFERENCES Usuarios(id_usuario) ON UPDATE CASCADE
);

CREATE TABLE Comentarios (
  id_comentario INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT,
  id_chat INT,
  contenido TEXT NOT NULL,
  fecha_creacion TEXT NOT NULL,
  CONSTRAINT fk_comentarios_id_usuario
      FOREIGN KEY (id_usuario)
      REFERENCES Usuarios(id_usuario) ON UPDATE CASCADE,
  CONSTRAINT fk_comentarios_id_chat
      FOREIGN KEY (id_chat)
      REFERENCES Chats(id_chat) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE Lista_videojuegos_JUDI (
  id_lista_JUDI INT PRIMARY KEY AUTO_INCREMENT,
  id_videojuego INT NOT NULL UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  fecha TEXT NOT NULL UNIQUE,
  calificacion INT NOT NULL,
  desarrollador TEXT NOT NULL,
  released TEXT NOT NULL
);

CREATE TABLE JUDI_fases_usuario (
  id_lista_JUDI INT,
  id_usuario INT,
  completado BOOLEAN NOT NULL DEFAULT false,
  fecha_completado TEXT NOT NULL,
  fase1 BOOLEAN NOT NULL DEFAULT false,
  fase2 BOOLEAN NOT NULL DEFAULT false,
  fase3 BOOLEAN NOT NULL DEFAULT false,
  fase4 BOOLEAN NOT NULL DEFAULT false,
  fase5 BOOLEAN NOT NULL DEFAULT false,
  fase6 BOOLEAN NOT NULL DEFAULT false,
  fase7 BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (id_lista_JUDI,id_usuario),
  CONSTRAINT fk_fases_id_lista_JUDI
      FOREIGN KEY (id_lista_JUDI)
      REFERENCES Lista_videojuegos_JUDI(id_lista_JUDI) ON UPDATE CASCADE,
  CONSTRAINT fk_fases_id_usuario
      FOREIGN KEY (id_usuario)
      REFERENCES Usuarios(id_usuario) ON UPDATE CASCADE
);

CREATE TABLE Capturas (
  captura VARCHAR(255) PRIMARY KEY,
  id_videojuego INT,
  CONSTRAINT fk_capturas_id_videojuego
      FOREIGN KEY (id_videojuego)
      REFERENCES Lista_videojuegos_JUDI(id_videojuego) ON UPDATE CASCADE
);

CREATE TABLE Plataformas (
  plataforma VARCHAR(255) PRIMARY KEY
);

CREATE TABLE Generos (
  genero VARCHAR(255) PRIMARY KEY
);

CREATE TABLE Videojuego_Plataforma (
  id_videojuego INT,
  plataforma VARCHAR(255),
  PRIMARY KEY (id_videojuego,plataforma),
  CONSTRAINT fk_vj_pl_id_videojuego
      FOREIGN KEY (id_videojuego)
      REFERENCES Lista_videojuegos_JUDI(id_videojuego) ON UPDATE CASCADE,
  CONSTRAINT fk_vj_pl_plataforma
      FOREIGN KEY (plataforma)
      REFERENCES Plataformas(plataforma) ON UPDATE CASCADE
);

CREATE TABLE Videojuego_Genero (
  id_videojuego INT,
  genero VARCHAR(255),
  PRIMARY KEY (id_videojuego,genero),
  CONSTRAINT fk_vj_ge_id_videojuego
      FOREIGN KEY (id_videojuego)
      REFERENCES Lista_videojuegos_JUDI(id_videojuego) ON UPDATE CASCADE,
  CONSTRAINT fk_vj_ge_genero
      FOREIGN KEY (genero)
      REFERENCES Generos(genero) ON UPDATE CASCADE
);

CREATE TABLE Logs (
  id_log INT PRIMARY KEY AUTO_INCREMENT,
  evento TEXT NOT NULL,
  fecha_insercion TEXT NOT NULL
);