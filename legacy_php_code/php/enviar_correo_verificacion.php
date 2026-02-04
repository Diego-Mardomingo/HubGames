<?php
$to = "diego.lopez.mardomingo@gmail.com";
$subject = "Verifica tu email en HubGames.es";

// $message = file_get_contents("./html/cuerpo_verificar_correo.php");

ob_start(); // Iniciar almacenamiento en búfer de salida
// include "./html/cuerpo_verificar_correo.php?token=".$_GET['token']; // Incluir el archivo con el enlace
file_get_contents("http://localhost/HubGames/html/cuerpo_verificar_correo.php?token=".$_GET['token']);
$message = ob_get_clean(); // Obtener el contenido del búfer y asignarlo a $message

$headers = "From: HubGames@hubgames.es\r\n";
// $headers .= "Reply-To: HubGames@hubgames.es\r\n";
$headers .= "Content-Type: text/html\r\n";

mail($to, $subject, $message, $headers);
?>