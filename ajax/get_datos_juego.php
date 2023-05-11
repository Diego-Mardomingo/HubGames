<?php
  session_start();
  require_once('../php/database.php');

  $conn = database::conectar();

  $id_lista_JUDI = $_POST['id_lista_JUDI'];
  
  if(isset($_SESSION['identificador'])){
    $id_usuario = $_SESSION['identificador'];
    $params = array(':id_usuario'=>$id_usuario,':id_lista_JUDI'=>$id_lista_JUDI);
    $pdo = $conn->prepare("SELECT * FROM Lista_videojuegos_JUDI JOIN JUDI_fases_usuario ON Lista_videojuegos_JUDI.id_lista_JUDI = JUDI_fases_usuario.id_lista_JUDI WHERE JUDI_fases_usuario.id_usuario = :id_usuario AND Lista_videojuegos_JUDI.id_lista_JUDI = :id_lista_JUDI");
    $pdo->execute($params);
    if($row = $pdo->fetch(PDO::FETCH_ASSOC)){
      $data['juego'] = $row;
    }
  }else{
    $juegos = json_decode($_COOKIE['lista']);
    for ($i=0; $i < sizeof($juegos); $i++) { 
      if($juegos[$i]['id_lista_JUDI'] == $id_lista_JUDI){
        $data['juego'] = $juegos[$i];
      }
    }
  }


  $paramsLista = array(':id_lista_JUDI'=>$id_lista_JUDI);
  $pdo = $conn->prepare("SELECT captura FROM Capturas NATURAL JOIN Lista_videojuegos_JUDI WHERE Lista_videojuegos_JUDI.id_lista_JUDI = :id_lista_JUDI ORDER BY id_lista_JUDI DESC");
  $pdo->execute($paramsLista);
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $data['capturas'][] = $row['captura'];
  }
  
  $pdo = $conn->prepare("SELECT genero FROM Lista_videojuegos_JUDI NATURAL JOIN Videojuego_Genero WHERE Lista_videojuegos_JUDI.id_lista_JUDI = :id_lista_JUDI");
  $pdo->execute($paramsLista);
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $data['generos'][] = $row['genero'];
  }
  
  $pdo = $conn->prepare("SELECT plataforma FROM Lista_videojuegos_JUDI NATURAL JOIN Videojuego_Plataforma WHERE Lista_videojuegos_JUDI.id_lista_JUDI = :id_lista_JUDI");
  $pdo->execute($paramsLista);
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $data['plataformas'][] = $row['plataforma'];
  }

  echo json_encode($data);
?>