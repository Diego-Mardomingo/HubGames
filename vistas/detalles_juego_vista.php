<!DOCTYPE html>
<html lang="en">
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
  <link rel="shortcut icon" href="../img/HGLogo.webp" type="image/x-icon">
  <link rel="stylesheet" href="../css/detalles_juego_style.css">
  <script src="https://kit.fontawesome.com/ed0e2390af.js" crossorigin="anonymous"></script>
  <script type="text/javascript" src="../js/jquery-3.6.4.min.js"></script>
  <script type="text/javascript" src="../js/detalles_juego_script.js"></script>
  <title>Detalles videojuego</title>
</head>
<body>
<?php
  session_start();
  isset($_SESSION['username']) ? include_once("../includes/nav_con_sesion.php") : include_once("../includes/nav_sin_sesion.php");
?>

  <div class="cuerpo"></div>
  <div class="reviews">
    <?php
    if(isset($_SESSION['username'])){
      echo '<div class="boton_new_review">Crear reseña <i class="fa-solid fa-plus"></i></div>';
    }else{
      echo '<div class="review_sin_sesion">Para crear reseñas debes <a href="https://HubGames.es/vistas/login_vista.php">iniciar sesión</a></div>';
    }
    ?>
    <div class="div_review"></div>
  </div>
  <!-- Modal -->
  <div id="modal" class="modal">
    <div class="modal-contenido">
      <h2>Crear reseña</h2>
      <div class="crear_encabezado">
        <label for="encabezado">Título:</label>
        <input type="text" id="encabezado">
      </div>
      <div class="crear_contenido">
        <label for="contenido">Contenido:</label>
        <textarea id="contenido"></textarea>
      </div>
      <div class="crear_valoracion">
        <label for="valoracion">Valoración:</label>
        <select name="valoracion" id="valoracion">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>
      <div class="botones">
        <button id="cancelar">Cancelar</button>
        <button id="crear">Crear</button>
      </div>
    </div>
  </div>

  <?php include_once("../includes/footer.php"); ?>
</body>
</html>