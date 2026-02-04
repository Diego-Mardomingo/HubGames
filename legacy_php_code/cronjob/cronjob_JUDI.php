<?php
require_once("database.php");

$randomGame;

obtenerJuegoRandom();




function insertarJuegoRandom($randomGame){

    // Formateamos plataformas y géneros
    $platforms = array_map(function ($platform) {
                return $platform['platform']['name'];
              }, $randomGame['platforms']);

    $genres = array_map(function ($genre) {
                return $genre['name'];
              }, $randomGame['genres']);

    //Imágenes del juego
    $imagenes=[];
    for ($i = 5; $i >= 0 ; $i--) { 
      $imagenes[] = $randomGame['short_screenshots'][$i]['image'];
    }

    // Información del juego
    $id_juego = $randomGame['id'];
    $nombre = $randomGame['name'];
    $fechaHoy = date('Y-m-d');
    $fecha = convertirFecha($fechaHoy);
    $released = convertirFecha($randomGame['released']);
    $rating = $randomGame['rating'];
    $nota = $randomGame['metacritic'];


    try {
      
      //* Insertamos los datos del juego en Lista_videojuegos_JUDI
      $paramsLista = array(':id_videojuego'=>$id_juego,':nombre'=>$nombre,':fecha'=>$fecha,':calificacion'=>$nota,':desarrollador'=>$rating,':released'=>$released);
      $conn = database::conectar();
      $pdo = $conn->prepare("INSERT INTO Lista_videojuegos_JUDI VALUES(NULL,:id_videojuego,:nombre,:fecha,:calificacion,:desarrollador,:released)");
      $pdo->execute($paramsLista);
  
      //* Insertamos las plataformas del juego
      foreach ($platforms as $key => $value) {
        $params=array(':id_videojuego'=>$id_juego,':valor'=>$value);
        $pdo = $conn->prepare("INSERT INTO Videojuego_Plataforma VALUES(:id_videojuego,:valor)");
        $pdo->execute($params);
      }
  
      //* Insertamos los géneros del juego
      foreach ($genres as $key => $value) {
        $params=array(':id_videojuego'=>$id_juego,':valor'=>$value);
        $pdo = $conn->prepare("INSERT INTO Videojuego_Genero VALUES(:id_videojuego,:valor)");
        $pdo->execute($params);
      }
  
      //* Insertamos las imagenes del juego
      foreach ($imagenes as $key => $value) {
        $params=array(':id_videojuego'=>$id_juego,':valor'=>$value);
        $pdo = $conn->prepare("INSERT INTO Capturas VALUES(:valor,:id_videojuego)");
        $pdo->execute($params);
      }

    } catch (PDOException $e) {
      obtenerJuegoRandom();
    }

}

function obtenerJuegoRandom(){

  // Configuración de la API
  $apiKey = 'REMOVED_FOR_SECURITY';
  $url = 'https://api.rawg.io/api/games';

  $busquedasAPI = 0;
  // Realiza la búsqueda
  while(empty($randomGame) && $busquedasAPI < 20){
    // Parámetros de búsqueda
    $numPagina = rand(1, 150); // Obtiene una página aleatoria entre 1 y 150
    $fechaHoy = date('Y-m-d');
    $fechaHace7Anyos = date('Y-m-d', strtotime('-10 years'));
    $searchParams = array(
        'key' => $apiKey,
        'ordering' => '-rating', // Ordena los juegos por popularidad descendente
        'page_size' => '50', // Obtiene 50 juegos por página
        'dates' => $fechaHace7Anyos.','.$fechaHoy, // Obtiene los juegos de los últimos 7 años
        'page' => $numPagina,
        'exclude_additions' => true,
    );

    $busquedasAPI++;

    $response = file_get_contents($url . '?' . http_build_query($searchParams));
  
    // Procesa los resultados
    $result = json_decode($response, true);
    $games = $result['results'];
  
    // Filtra los juegos para obtener uno que cumpla con los requisitos
    $filteredGames = array_filter($games, function($game) {
        return $game['reviews_count'] >= 300 && sizeof($game['short_screenshots']) >= 6; // Filtramos los juegos
    });
  
    // Obtiene un juego aleatorio de los filtrados
    if(!empty($filteredGames)){
      $randomIndex = array_rand($filteredGames);
      $randomGame = $filteredGames[$randomIndex];
    }
  }
  
  // Formateamos plataformas y géneros
  $platforms = array_map(function ($platform) {
    return $platform['platform']['name'];
  }, $randomGame['platforms']);
  $platforms_str = implode(', ', $platforms);

  $genres = array_map(function ($genre) {
      return $genre['name'];
  }, $randomGame['genres']);
  $genres_str = implode(', ', $genres);

  // //Imágenes del juego
  // for ($i = 5; $i >= 0 ; $i--) { 
  //   echo '<img width="500px" src="'.$randomGame['short_screenshots'][$i]['image'].'">';
  //   echo "<br>";
  // }

  // // Muestra la información del juego
  // echo 'Búsquedas: ' . $busquedasAPI . '<br>';
  // echo 'ID Juego: ' . $randomGame['id'] . '<br>';
  // echo 'Juego: ' . $randomGame['name'] . '<br>';
  // echo 'Fecha de hoy: ' . convertirFecha($fechaHoy) . '<br>';
  // echo 'Fecha de lanzamiento: ' . convertirFecha($randomGame['released']) . '<br>';
  // echo 'Popularidad: ' . $randomGame['rating'] . '/5<br>';
  // echo 'Metacritic: ' . $randomGame['metacritic'] . '<br>';
  // echo "Plataformas: $platforms_str". '<br>';
  // echo "Géneros: $genres_str". '<br>';


  // echo '<br>'. '<br>';
  // echo 'ratings_count: ' . $randomGame['ratings_count'] . '<br>';
  // echo 'reviews_count: ' . $randomGame['reviews_count'] . '<br>';

  insertarJuegoRandom($randomGame);

}

  function convertirFecha($fecha) {
    $partesFecha = explode('-', $fecha);
    $fechaConvertida = $partesFecha[2] . '-' . $partesFecha[1] . '-' . $partesFecha[0];
    return $fechaConvertida;
}


?>