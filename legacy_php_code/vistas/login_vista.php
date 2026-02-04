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
  <meta name="description" content="Inicia sesión en HubGames y encuentra los mejores videojuegos en nuestro buscador.">
  <meta name="keywords" content="hubgames,hub games,videojuegos, juegos, buscador, entretenimiento">
  <meta name="author" content="Diego López Mardomingo">
  <link rel="shortcut icon" href="../img/HGLogo.webp" type="image/x-icon">
  <script src="https://kit.fontawesome.com/ed0e2390af.js" crossorigin="anonymous"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <link rel="stylesheet" href="../css/login_style.css">
  <script type="text/javascript" src="../js/jquery-3.6.4.min.js"></script>
  <script type="text/javascript" src="../js/login_script.js"></script>
  
  <title>Iniciar Sesión | HubGames</title>
</head>
<body>
<?php
  session_start();
  isset($_SESSION['username']) ? include_once("../includes/nav_con_sesion.php") : include_once("../includes/nav_sin_sesion.php");?>

<div class="cuerpo">
  <h1 class="encabezado">Iniciar sesión</h1>
  <div class="boton_google">
    <div id="g_id_onload"
      data-client_id="REMOVED_FOR_SECURITY"
      data-context="signin"
      data-ux_mode="popup"
      data-callback="googleLogin"
      data-auto_prompt="false">
    </div>

    <div class="g_id_signin"
        data-type="standard"
        data-shape="rectangular"
        data-theme="outline"
        data-text="signin_with"
        data-size="large"
        data-locale="es"
        data-logo_alignment="left">
    </div>
  </div>
  <div class="credenciales">
    <div class="email">
      <input type="text" required autocomplete="off" name="email" id="email">
      <label for="email">Email</label>
      <i class="fa-solid fa-at"></i>
    </div>
    <div class="pass">
      <input type="password" required autocomplete="off" name="pass" id="pass">
      <label for="pass">Contraseña</label>
      <i class="fa-solid fa-key"></i>
    </div>
  </div>
  <div class="boton_submit">Iniciar sesión</div>
  <div class="enlace_alternativo">¿No tienes cuenta aún? <a href="./registro_vista.php">Crea tu cuenta aquí</a></div>
  <div class="enlace_alternativo2"><a href="./forgetpass_vista.php">He olvidado mi contraseña</a></div>
</div>


</body>
</html>