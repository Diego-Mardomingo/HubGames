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
  <link rel="stylesheet" href="../css/chats_style.css">
  <script src="https://kit.fontawesome.com/ed0e2390af.js" crossorigin="anonymous"></script>
  <script type="text/javascript" src="../js/jquery-3.6.4.min.js"></script>
  <script type="text/javascript" src="../js/chats_script.js"></script>
  <title>Chats | HubGames</title>
</head>
<body>
<?php
  session_start();
  isset($_SESSION['username']) ? include_once("../includes/nav_con_sesion.php") : include_once("../includes/nav_sin_sesion.php");
?>

  <div class="cuerpo">
    <div class="chats">
      <?php
      if(isset($_SESSION['username'])){
        echo '<div class="boton_new_chat">Crear un nuevo chat <i class="fa-solid fa-plus"></i></div>';
      }else{
        echo '<div class="chat_sin_sesion">Para crear un chat debes <a href="https://HubGames.es/vistas/login_vista.php">iniciar sesión</a></div>';
      }
      ?>
      <!-- <div class="div_chat"></div> -->
    </div>
  </div>
  <!-- Modal -->
  <div id="modal" class="modal">
    <div class="modal-contenido">
      <h2>Crear un nuevo chat</h2>
      <div class="crear_encabezado">
        <label for="encabezado">Título:</label>
        <input type="text" id="encabezado">
      </div>
      <div class="crear_contenido">
        <label for="contenido">Contenido:</label>
        <textarea id="contenido"></textarea>
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