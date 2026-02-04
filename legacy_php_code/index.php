<!DOCTYPE html>
<html lang="es">

<head>

<!-- ESTO ES SOLO PARA QUE GOOGLE PUEDA TENER ESTADÍSTICAS DE LA PÁGINA PARA MEJORAR LA INDEXACIÓN (SEO) -->
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-X3VGMMX2JX"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
    
      gtag('config', 'G-X3VGMMX2JX');
    </script>
<!-- AQUÍ ACABA -->

  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Encuentra los mejores videojuegos en nuestro buscador.">
  <meta name="keywords" content="hubgames,hub games,videojuegos, juegos, buscador, entretenimiento">
  <meta name="author" content="Diego López Mardomingo">
  <link rel="shortcut icon" href="img/HGLogo.webp" type="image/x-icon">
  <link rel="stylesheet" href="css/index_style.css">
  <link rel="canonical" href="https://hubgames.es" />
  <script src="https://kit.fontawesome.com/ed0e2390af.js" crossorigin="anonymous"></script>
  <script type="text/javascript" src="js/lazysizes.min.js" async=""></script>
  <script type="text/javascript" src="js/jquery-3.6.4.min.js"></script>
  <script type="text/javascript" src="js/index_script.js"></script>
  <title>HubGames</title>
</head>

<body>
  <?php
  session_start();
  
  isset($_SESSION['username']) ? include_once("includes/nav_con_sesion.php") : include_once("includes/nav_sin_sesion.php");?>

<div class="cuerpo">
  <div class="cuerpo_cabecera">
    <div class="buscador_container">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="text" id="buscador_videojuegos" spellcheck="false" placeholder=" ¿Qué buscamos?">
      <i class="fa-solid fa-xmark" id="limpiar_buscador"></i>
    </div>
      <div class="filtro_container">
        <div class="boton_filtros" title="Filtrar juegos">Filtrar<i class="fa-solid fa-angles-down"></i></div>
        <div class="filtros"></div>
      </div>
      <div class="buscador_boton"><i class="fa-solid fa-magnifying-glass"></i>Buscar</div>
    </div>
    <div class="filtros_activos_container">
    </div>
    <div class="enlaces_paginas">
      <div class="pag_anterior"></div>
      <div class="pag_siguiente"></div>
    </div>
    <div class="juegos">
      
    </div>
    
  </div>

  <?php include_once("includes/footer.php"); ?>
</body>

</html>