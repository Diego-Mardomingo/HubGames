<?php
require_once("../php/database.php");


// importarGeneros();
// importarPlataformas();

function importarGeneros(){
  // Configuración de la API
  $apiKey = 'REMOVED_FOR_SECURITY';
  $url = 'https://api.rawg.io/api/genres';

  // Parámetros de búsqueda
  $searchParams = array(
      'key' => $apiKey,
      'page_size' => '50',
  );

  $response = file_get_contents($url . '?' . http_build_query($searchParams));
  $result = json_decode($response, true);

  $arrayGeneros = [];
  for ($i=0; $i < sizeof($result['results']); $i++) {
    $arrayGeneros[]=$result['results'][$i]['name'];
  }

  print_r($arrayGeneros);
  echo "<br>";

  $conn = database::conectar();
  foreach ($arrayGeneros as $key => $value) {
    $params=array(':valor'=>$value);
    $pdo = $conn->prepare("INSERT INTO Generos (genero) VALUES(:valor)");
    $pdo->execute($params);
  }
}

function importarPlataformas(){
  // Configuración de la API
  $apiKey = '3b597a76023d49faa0deba195b7b78b7';
  $url = 'https://api.rawg.io/api/platforms';

  // Parámetros de búsqueda
  $searchParams = array(
      'key' => $apiKey,
      'page_size' => '50',
      'page' => 1
  );

  $response = file_get_contents($url . '?' . http_build_query($searchParams));
  $result = json_decode($response, true);
  
  $arrayPlataformas = [];
  for ($i=0; $i < sizeof($result['results']); $i++) {
    $arrayPlataformas[]=$result['results'][$i]['name'];
  }
  
  $searchParams2 = array(
      'key' => $apiKey,
      'page_size' => '50',
      'page' => 2
  );

  $response = file_get_contents($url . '?' . http_build_query($searchParams2));
  $result = json_decode($response, true);

  for ($i=0; $i < sizeof($result['results']); $i++) {
    $arrayPlataformas[]=$result['results'][$i]['name'];
  }

  print_r($arrayPlataformas);

  $conn = database::conectar();
  foreach ($arrayPlataformas as $key => $value) {
    $params=array(':valor'=>$value);
    $pdo = $conn->prepare("INSERT INTO Plataformas (plataforma) VALUES(:valor)");
    $pdo->execute($params);
  }
}

?>