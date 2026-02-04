<?php
  require_once("../php/database.php");

  $conn = database::conectar();
  $email = $_POST['email'];
  $params = array(':email'=>$email);
  $pdo = $conn->prepare("SELECT * FROM Usuarios WHERE email = :email");
  $pdo->execute($params);
  $fila = $pdo->fetch(PDO::FETCH_ASSOC);
  echo json_encode($fila);
?>