<?php
  require_once('../php/database.php');

  $id_chat = $_POST['id_chat'];

  $conn = database::conectar();
  $params = array(':id_chat'=>$id_chat);
  $pdo = $conn->prepare("SELECT * FROM Chats JOIN Usuarios ON Chats.id_usuario = Usuarios.id_usuario WHERE id_chat = :id_chat ");
  $pdo->execute($params);
  $row = $pdo->fetch(PDO::FETCH_ASSOC);
  echo json_encode($row);
?>