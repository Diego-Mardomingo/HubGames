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
  <link rel="stylesheet" href="../css/JUDI_style.css">
  <script src="https://kit.fontawesome.com/ed0e2390af.js" crossorigin="anonymous"></script>
  <script type="text/javascript" src="../js/jquery-3.6.4.min.js"></script>
  <script type="text/javascript" src="../js/JUDI_script.js"></script>
  <title>JUDI | HubGames</title>
</head>
<body>
<?php
  session_start();
  isset($_SESSION['username']) ? include_once("../includes/nav_con_sesion.php") : include_once("../includes/nav_sin_sesion.php");
?>

  <div class="cuerpo">
    <div class="titulo">
      <h1>JUDI</h1>
      <h3>(Juego del día)</h3>
    </div>
    <div class="sesion">
      <?php
      if(!isset($_SESSION['username'])){
        echo '<div>Recomendamos <a href="https://hubgames.es/vistas/login_vista.php">iniciar sesión</a> para poder guardar tu progreso</div>';
      }
      ?>
    </div>
    <div class="lista"></div>
  </div>

  <?php include_once("../includes/footer.php"); ?>
</body>
</html>