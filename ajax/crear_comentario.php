<?php
  session_start();
  require_once('../php/database.php');

  $contenido = $_POST['contenido'];
  $id_chat = $_POST['id_chat'];

  $id_usuario = $_SESSION['identificador'];
  $fecha_creacion = date('d/m/Y');

  $params = array(':contenido'=>$contenido,':id_chat'=>$id_chat,':id_usuario'=>$id_usuario,':fecha_creacion'=>$fecha_creacion);
  $conn = database::conectar();
  $pdo = $conn->prepare("INSERT INTO Comentarios VALUES(NULL,:id_usuario,:id_chat,:contenido,:fecha_creacion)");
  $pdo->execute($params);

  echo json_encode($pdo->rowCount());
?>