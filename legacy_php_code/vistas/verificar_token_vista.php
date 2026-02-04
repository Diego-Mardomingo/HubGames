<?php
$token = base64_decode($_GET['token']);
session_start();
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="shortcut icon" href="../img/HGLogo.webp" type="image/x-icon">
  <title>Verificación email | HubGames</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

    * {
      box-sizing: border-box;
      font-family: 'Montserrat', sans-serif;
    }

    body {
      min-height: 95vh;
      background-image: url("../img/menteUpScale.webp");
      background-repeat: no-repeat;
      background-attachment: fixed;
      background-position: top center;
      background-size: cover;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    .cuerpo{
      background-color: rgba(0, 23, 31, .8);
      margin: auto;
      padding: 2em;
      color: #fff;
      border-radius: 5px;
      text-align: center;
    }
    h3{
      font-weight: 400;
    }
    a{
      text-decoration: none;
      background-color: #00171F;
      border-radius: 5px;
      padding: 1em;
      color: #fff;
    }
    a:hover{
      background-color: #052935;
    }
  </style>
</head>

<body>
  <div class="cuerpo">
    <?php
    if (base64_decode($_SESSION['token']) == $token) {
      require_once("../php/database.php");
      $conn = database::conectar();
      $params=array(':email'=>$token);
      $pdo = $conn->prepare("UPDATE Usuarios SET email_verificado = 1 WHERE email = :email");
      $pdo->execute($params);
    ?>
      <h1>Enhorabuena se ha verificado la cuenta con email <i><?php echo $token ?></i> exitosamente</h1>
      <h3>Ahora puedes iniciar sesión</h3>
      <a href="https://hubgames.es/vistas/login_vista.php">Iniciar sesión</a>
    <?php
    } else {
    ?>
      <h1>Ha ocurrido un problema</h1>
    <?php
    }
    ?>
  </div>
</body>

</html>