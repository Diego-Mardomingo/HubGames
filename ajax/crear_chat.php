<?php
session_start();
  require_once('../php/database.php');

  $titulo = $_POST['encabezado'];
  $contenido = $_POST['contenido'];

  $id_usuario = $_SESSION['identificador'];
  $fecha_creacion = date('d/m/Y');

  $params = array(':titulo'=>$titulo,':contenido'=>$contenido,':id_usuario'=>$id_usuario,':fecha_creacion'=>$fecha_creacion);
  $conn = database::conectar();
  $pdo = $conn->prepare("INSERT INTO Chats VALUES(NULL,:id_usuario,:titulo,:contenido,:fecha_creacion)");
  $pdo->execute($params);

  $lastId = $conn->lastInsertId();
  $params2 = array(':id_chat'=>$lastId);
  $conn2 = database::conectar();
  $pdo2 = $conn2->prepare("SELECT id_chat FROM Chats WHERE id_chat = :id_chat");
  $pdo2->execute($params2);

  echo json_encode($pdo2->fetch());
?>