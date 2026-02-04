<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="shortcut icon" href="../img/HGLogo.webp" type="image/x-icon">
  <title>Administración | HubGames</title>
  <link rel="stylesheet" href="../css/administrar_style.css">
  <script src="https://kit.fontawesome.com/ed0e2390af.js" crossorigin="anonymous"></script>
  <script type="text/javascript" src="../js/jquery-3.6.4.min.js"></script>
  <script type="text/javascript" src="../js/administrar_script.js"></script>
</head>
<body>
<?php
  session_start();
  if($_SESSION['administrador'] != 1){
    header('Location: https://hubgames.es');
  }
  isset($_SESSION['username']) ? include_once("../includes/nav_con_sesion.php") : include_once("../includes/nav_sin_sesion.php");
?>
  <div class="cuerpo">
    <div class="botones">
      <div class="boton boton_logs">Últimos logs <i class="fa-solid fa-bars-staggered"></i></div>
      <div class="boton boton_reviews">Reseñas <i class="fa-solid fa-star"></i></div>
      <div class="boton boton_chats">Chats <i class="fa-solid fa-message"></i></div>
      <div class="boton boton_usuarios">Usuarios <i class="fa-solid fa-user"></i></div>
    </div>
    <div class="data"></div>
  </div>

  <?php include_once("../includes/footer.php"); ?>
</body>
</html>

