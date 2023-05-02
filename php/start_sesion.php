<?php

session_start();
$_SESSION['username'] = $_POST['username'];
$_SESSION['identificador'] = $_POST['identificador'];
if(isset($_POST['administrador'])){
  $_SESSION['administrador'] = $_POST['administrador'];
}

echo json_encode("1");

?>