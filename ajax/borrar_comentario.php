<?php
  require_once('../php/database.php');

  $conn = database::conectar();
  $id_comentario = $_POST['id_comentario'];
  $params = array(':id_comentario'=>$id_comentario);
  $pdo = $conn->prepare("DELETE FROM Comentarios WHERE id_comentario = :id_comentario");
  $pdo->execute($params);
  
  echo json_encode($pdo->rowCount());
?>