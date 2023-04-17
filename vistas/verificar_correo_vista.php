<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="shortcut icon" href="../img/HGLogo.webp" type="image/x-icon">
  <title>Verificar correo | HubGames</title>
  <link rel="stylesheet" href="../css/verificar_correo_style.css">
  <script type="text/javascript" src="../js/jquery-3.6.4.min.js"></script>
  <!-- <script type="text/javascript" src="../js/registro_script.js"></script> -->
</head>
<body>
  <div class="cuerpo">
    <h1>Debes verificar tu correo electrónico para continuar</h1>
    <h4>Se ha mandado un correo electrónico al email <span><?php echo $_GET['email'] ?></span></h4>
    <i>Puedes cerrar esta pestaña</i>
  </div>
</body>
</html>
<?php

$to = "diego.lopez.mardomingo@gmail.com";
$subject = "Verifica tu email en HubGames.es";

$message = '
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    h1{
      margin: auto;
      color: blue;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>Verifica tu correo electrónico</h1>
  <a href="https://hubgames.es/vistas/verificar_token_vista.php?token='. $_GET["email"] .'">Clica aquí</a>
</body>
</html>
';

$headers = "From: HubGames@hubgames.es\r\n";
$headers .= "Reply-To: HubGames@hubgames.es\r\n";
$headers .= "Content-Type: text/html\r\n";

mail($to, $subject, $message, $headers);
?>