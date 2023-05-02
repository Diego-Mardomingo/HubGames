<?php
require_once('../php/database.php');

  $email = $_POST["email"];
  $pass = $_POST["pass"];

  $conn = database::conectar();

  $params = array(":email"=>$email);

  $pdo = $conn->prepare("SELECT * FROM Usuarios WHERE email=:email");
  $pdo->execute($params);
  $fila = $pdo->fetch(PDO::FETCH_ASSOC);
  $passHash = $fila['password'];

  if(password_verify($pass,$passHash)){
    $resultado['id_usuario'] = $fila['id_usuario'];
    $resultado['username'] = $fila['username'];
    $resultado['administrador'] = $fila['administrador'];
  }else{
    $resultado = 0;
  }

  echo json_encode($resultado)
?>