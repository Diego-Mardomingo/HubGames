<?php

  require_once('../php/database.php');

  $username = $_POST['username'];
  $email = $_POST['email'];
  $pass = $_POST['pass'];
  if($pass != null){
    $pass = password_hash($pass,PASSWORD_BCRYPT);
  }
  $email_verificado = $_POST['email_verificado'];
  $fecha_creacion = $_POST['fecha_creacion'];
  $cuenta_google = $_POST['cuenta_google'];

  $params = array(':username' => $username,':email' => $email,':pass' => $pass,':email_verificado' => $email_verificado,':fecha_creacion'=>$fecha_creacion,':cuenta_google'=>$cuenta_google);

  $conn = database::conectar();
  $pdo = $conn->prepare("INSERT INTO Usuarios(id_usuario,username,email,password,email_verificado,fecha_creacion,cuenta_google,administrador) VALUES(NULL,:username,:email,:pass,:email_verificado,:fecha_creacion,:cuenta_google, 0)");
  $pdo->execute($params);

  $conn2 = database::conectar();
  $params2 = array(':email'=>$email);
  $pdo2 = $conn2->prepare("SELECT id_usuario FROM Usuarios WHERE email = :email");
  $pdo2->execute($params2);
  $resultado = $pdo2->fetch(PDO::FETCH_ASSOC);

  echo json_encode($resultado);

?>