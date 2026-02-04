<?php
  require_once('../php/database.php');

  $conn = database::conectar();
  $pdo = $conn->prepare("SELECT * FROM Usuarios ORDER BY id_usuario DESC");
  $pdo->execute();
  $usuarios = [];
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $usuarios[] = $row;
  }
  echo json_encode($usuarios);
?>