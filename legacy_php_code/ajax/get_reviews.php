<?php
  require_once('../php/database.php');

  $id_juego = $_POST['id_juego'];

  $conn = database::conectar();

  $params = array('id_videojuego'=>$id_juego);
  $pdo = $conn->prepare("SELECT * FROM Reviews JOIN Usuarios ON Reviews.id_usuario = Usuarios.id_usuario WHERE id_videojuego = :id_videojuego ORDER BY id_review DESC");
  $pdo->execute($params);
  $reviews = [];
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $reviews[] = $row;
  }
  echo json_encode($reviews);
?>