<?php
  require_once('../php/database.php');

  $conn = database::conectar();
  $pdo = $conn->prepare("SELECT * FROM Reviews JOIN Usuarios ON Reviews.id_usuario = Usuarios.id_usuario ORDER BY id_review DESC");
  $pdo->execute();
  $reviews = [];
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $reviews[] = $row;
  }
  echo json_encode($reviews);
?>