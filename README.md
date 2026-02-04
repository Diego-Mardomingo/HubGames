<p align="center">
  <img src="./public/img/HGLogo.webp" alt="HubGames Logo" width="200">
</p>

# HubGames

**Explora, sigue y comparte tu pasión por los videojuegos**

HubGames es una plataforma web personal diseñada para entusiastas de los videojuegos.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple)](https://web.dev/progressive-web-apps/)

---

## 🎮 Funcionalidades Principales

### 🔍 Buscador Inteligente
Integrado con la API de **RAWG**, HubGames ofrece acceso a una base de datos masiva de videojuegos.
- **Filtros avanzados**: Encuentra juegos por género, plataforma o fecha de lanzamiento.
- **Detalles completos**: Screenshots, descripciones, desarrolladores y valoraciones de Metacritic.

### 👤 Comunidad y Reseñas
Un espacio para compartir opiniones y debatir sobre juegos.
- **Sistema de Reseñas**: Deja tu valoración (1-5 estrellas) y lee las opiniones de otros usuarios.
- **Foros de Discusión**: Crea hilos de chat sobre cualquier temática y responde a otros miembros de la comunidad.
- **Perfiles**: Gestión de identidad mediante autenticación segura (incluyendo Google OAuth).

### 📊 Sistema JUDI (Juego Del Día)
Inspirado por conceptos como **Wordle**, JUDI propone un reto diario para los entusiastas de los videojuegos.
- Cada día se selecciona un título específico ("Juego Del Día") y los usuarios deben adivinar de qué juego se trata.
- El sistema ofrece hasta **7 intentos**, donde cada intento fallido revela una **nueva imagen o pista visual** del juego.
- El progreso de cada reto diario se sincroniza con la nube para usuarios registrados y se mantiene localmente para visitantes.

### 📱 Experiencia Móvil (PWA)
HubGames está construido como una **Progressive Web App**, lo que permite una experiencia fluida e instalable:
- Instalación directa en la pantalla de inicio de **iOS** y **Android**.
- Modo "standalone" que elimina la interfaz del navegador para una sensación de app nativa.
- Soporte para navegación offline.

---

## 🛠️ Arquitectura Técnica

El proyecto ha sido recientemente migrado de una arquitectura tradicional (PHP/MySQL) a un stack moderno centrado en la velocidad y escalabilidad:

- **Frontend**: Next.js 14 con App Router para una navegación instantánea y SEO optimizado.
- **Backend**: Supabase, aprovechando PostgreSQL para los datos y Row Level Security (RLS) para la seguridad.
- **Estilos**: Una combinación de Tailwind CSS y CSS personalizado para mantener la estética original del proyecto.
- **Infraestructura**: Desplegado y optimizado para la plataforma Vercel.

---

## 👨‍💻 Sobre el Proyecto

HubGames nació como un proyecto personal de aprendizaje y ha evolucionado hacia una herramienta robusta de gestión de bibliotecas de juegos. 

**Autor**: [Diego López Mardomingo](https://github.com/Diego-Mardomingo)

---

## 📚 Referencias Históricas

Este repositorio conserva el **código legacy PHP** original en la carpeta [`legacy_php_code/`](./legacy_php_code/README.md). Dicho código servía como base previa a la migración total realizada en febrero de 2026.

---
*Nota: Este es un proyecto personal. Los datos de videojuegos son proporcionados por la API de RAWG.*
