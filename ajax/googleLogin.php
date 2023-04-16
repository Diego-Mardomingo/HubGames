<?php
  require_once "../vendor/autoload.php";

  $credenciales = $_POST['credenciales'];
  $id_cliente = $_POST['id_cliente'];

  $cliente = new Google_Client(['client_id'=>$id_cliente]);
  $datosCliente = $cliente->verifyIdToken($credenciales);
  if($datosCliente){
    echo json_encode($datosCliente);
  }else{
    echo json_encode("Token inválido");
  }
