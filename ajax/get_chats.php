<?php
  require_once('../php/database.php');

  $conn = database::conectar();
  $pdo = $conn->prepare("SELECT * FROM Chats ORDER BY id_chat DESC");
  $pdo->execute();
  $chats = [];
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $chats[] = $row;
  }
  echo json_encode($chats);
?>