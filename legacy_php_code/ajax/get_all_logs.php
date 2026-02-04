<?php
  require_once('../php/database.php');

  $conn = database::conectar();
  $pdo = $conn->prepare("SELECT * FROM Logs ORDER BY id_log DESC");
  $pdo->execute();
  $logs = [];
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $logs[] = $row;
  }
  echo json_encode($logs);
?>