<?php
  require_once('../php/database.php');

  $conn = database::conectar();
  $id_review = $_POST['id_review'];
  $params = array(':id_review'=>$id_review);
  $pdo = $conn->prepare("DELETE FROM Reviews WHERE id_review = :id_review");
  $pdo->execute($params);
  
  echo json_encode($pdo->rowCount());
?>