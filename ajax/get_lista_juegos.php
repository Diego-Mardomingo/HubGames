<?php
  session_start();
  require_once('../php/database.php');

  $conn = database::conectar();

  
  $pdo = $conn->prepare("SELECT * FROM Lista_videojuegos_JUDI ORDER BY id_lista_JUDI DESC");
  $pdo->execute();
  $juegos = [];
  while($row = $pdo->fetch(PDO::FETCH_ASSOC)){
    $juegos[] = $row;
  }

  //* Primero voy a inicializar todos los juegos para los usuarios e invitados
  if(isset($_SESSION['identificador'])){
    //* Sesión iniciada
    for ($i=0; $i < sizeof($juegos); $i++) { 
      $params=array(':id_usuario'=>$_SESSION['identificador'],':id_lista_JUDI'=>$juegos[$i]['id_lista_JUDI']);
      $pdo = $conn->prepare("SELECT * FROM JUDI_fases_usuario WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      if($row = $pdo->fetch(PDO::FETCH_ASSOC)){
        //* El juego ya está inicializado
        //* Añadimos al array 'juegos' el estado del juego (Completado = true/false)
        $juegos[$i]['completado'] = $row['completado'];
        $juegos[$i]['fase6'] = $row['fase6'];
      }else{
        //* El juego no está inicializado
        //* Inicializamos el juego
        $pdo = $conn->prepare("INSERT INTO JUDI_fases_usuario VALUES(:id_lista_JUDI,:id_usuario,0,NULL,0,0,0,0,0,0,0)");
        $pdo->execute($params);
        //* Si acabamos de inicializar el juego el estado siempre será false (0)
        $juegos[$i]['completado'] = 0;
        $juegos[$i]['fase6'] = 0;
      }
    }
  }else{
    //* Sesión NO iniciada
    //* Deberemos guardarlo en una cookie
    if(isset($_COOKIE['lista_JUDI'])){
      //* La cookie existe
      //* Primero debemos deserializarla
      $lista_JUDI = unserialize($_COOKIE['lista_JUDI']);
      //* Ahora inicializamos todos aquellos juegos que no estén inicializados
      for ($i=0; $i < sizeof($juegos); $i++) { 
        if($juegos[$i]['id_videojuego'] == $lista_JUDI[$i]['id_videojuego']){
          //* El juego ya está inicializado
          //* Guardamos su progreso
          $juegos[$i]['completado'] = $lista_JUDI[$i]['completado'];
          $juegos[$i]['fase6'] = $lista_JUDI[$i]['fase6'];
        }else{
          //* El juego NO está inicializado
          //* Inicializamos el juego
          $juegos[$i]['completado'] = 0;
          $juegos[$i]['fase6'] = 0;
        }
      }
      //* Ahora actualizamos la cookie
      //* Para poder almacenar el array en una cookie debemos serializarlo
      $lista_JUDI_serializada = serialize($juegos);
      //* Actualizamos la cookie con 10 años de expiración
      setcookie("lista_JUDI",$lista_JUDI_serializada,time() + (10 * 365 * 24 * 60 * 60));
    }else{
      //* La cookie no existe
      //* Inicializamos todos los juegos
      for ($i=0; $i < sizeof($juegos); $i++) { 
        $juegos[$i]['completado'] = 0;
        $juegos[$i]['fase6'] = 0;
      }
      //* Para poder almacenar el array en una cookie debemos serializarlo
      $lista_JUDI_serializada = serialize($juegos);
      //* Creamos la cookie con 10 años de expiración
      setcookie("lista_JUDI",$lista_JUDI_serializada,time() + (10 * 365 * 24 * 60 * 60));
    }
  }



  echo json_encode($juegos);
?>