<?php
  require_once('../php/database.php');

  $id_chat = $_POST['id_chat'];

  $params = array(':id_chat'=>$id_chat);

  $conn = database::conectar();
  $pdo = $conn->prepare("SELECT id_comentario, contenido, Comentarios.fecha_creacion as 'fecha_creacion', Usuarios.id_usuario as 'id_usuario', username FROM Comentarios JOIN Usuarios ON Comentarios.id_usuario = Usuarios.id_usuario WHERE id_chat = :id_chat ORDER BY id_comentario DESC");
  $pdo->execute($params);
  $comentarios = [];
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $comentarios[] = $row;
  }
  echo json_encode($comentarios);
?>