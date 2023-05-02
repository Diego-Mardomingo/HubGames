<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="shortcut icon" href="../img/HGLogo.webp" type="image/x-icon">
  <title>Verificar correo | HubGames</title>
  <link rel="stylesheet" href="../css/verificar_correo_style.css">
</head>
<body>
  <div class="cuerpo">
    <h1>Debes verificar tu correo electrónico para continuar</h1>
    <h4>Se ha mandado un correo electrónico al email <span><?php echo $_GET['email'] ?></span></h4>
    <i>Puedes cerrar esta pestaña</i>
    <a class="enlace" href="https://hubgames.es"><div>Volver al inicio</div></a>
  </div>
</body>
</html>
<?php

// $to = "diego.lopez.mardomingo@gmail.com";
$to = $_GET['email'];
$subject = "Verifica tu email en HubGames.es";

$token = base64_encode($_GET['email']);
session_start();
$_SESSION['token']=$token;

$message = '
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Verificación de correo electrónico</title>
    <style>
      /* Estilos para el cuerpo del correo */
      body {
        background-color: #f2f2f2;
        font-family: Arial, sans-serif;
        color: #555555;
      }
      
      /* Estilos para el contenedor principal */
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #ffffff;
        border-radius: 5px;
        box-shadow: 0px 2px 5px rgba(0,0,0,0.1);
      }
      
      /* Estilos para los títulos */
      h1, h2 {
        text-align: center;
        margin-bottom: 20px;
      }
      
      /* Estilos para los enlaces */
      a {
        color: #0078d4;
        text-decoration: none;
        font-weight: bold;
      }
      
      /* Estilos para los botones */
      .button {
        display: inline-block;
        padding: 10px 20px;
        background-color: #0078d4;
        color: #ffffff;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        border-radius: 5px;
        text-decoration: none;
      }
      
      .button:hover {
        background-color: #005a9e;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Verificación de correo electrónico en HubGames.es</h1>
      <p>Gracias por registrarte en HubGames.es. Para verificar tu dirección de correo electrónico, por favor haz clic en el siguiente enlace:</p>
      <p><a href="https://hubgames.es/vistas/verificar_token_vista.php?token='. $token .'">[Enlace de verificación]</a></p>
      <p>Si no has solicitado la verificación de tu dirección de correo electrónico, puedes ignorar este mensaje.</p>
      <p>¡Gracias!</p>
    </div>
  </body>
</html>
';

$headers = "From: HubGames@hubgames.es\r\n";
$headers .= "Reply-To: HubGames@hubgames.es\r\n";
$headers .= "Content-Type: text/html\r\n";

mail($to, $subject, $message, $headers);
?>
