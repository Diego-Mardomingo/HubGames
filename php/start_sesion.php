<?php

session_start();
$_SESSION['username'] = $_POST['username'];
$_SESSION['identificador'] = $_POST['identificador'];

echo json_encode("1");

?>