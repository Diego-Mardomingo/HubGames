<?php
session_start();
  require_once('../php/database.php');

  $encabezado = $_POST['encabezado'];
  $contenido = $_POST['contenido'];
  $valoracion = $_POST['valoracion'];
  $id_juego = $_POST['id_juego'];

  $id_usuario = $_SESSION['identificador'];
  $fecha_creacion = date('d/m/Y');

  $params = array(':encabezado'=>$encabezado,':contenido'=>$contenido,':valoracion'=>$valoracion,':id_juego'=>$id_juego,':id_usuario'=>$id_usuario,':fecha_creacion'=>$fecha_creacion);
  $conn = database::conectar();
  $pdo = $conn->prepare("INSERT INTO Reviews VALUES(NULL,:id_usuario,:encabezado,:contenido,:valoracion,:fecha_creacion,:id_juego)");
  $pdo->execute($params);

  echo json_encode($pdo->rowCount());
?>