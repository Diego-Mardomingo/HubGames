<?php
  require_once('../php/database.php');

  $conn = database::conectar();
  $id_chat = $_POST['id_chat'];
  $params = array(':id_chat'=>$id_chat);
  $pdo = $conn->prepare("DELETE FROM Chats WHERE id_chat = :id_chat");
  $pdo->execute($params);
  
  echo json_encode($pdo->rowCount());
?>