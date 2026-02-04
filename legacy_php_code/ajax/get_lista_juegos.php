<?php
  session_start();
  require_once('../php/database.php');

  $conn = database::conectar();

  $user_hubgames = $_POST['user_hubgames'];

  
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
    if(isset($user_hubgames)){
      $user = $user_hubgames;
      //* Comprobamos que exista el archivo asociado
      $nombreArchivo = '../datos_judi/'.$user.'.txt';
      if(file_exists($nombreArchivo)){
        //* El archivo existe
        //* Primero debemos obtener los datos de su archivo txt asociado
        $lista_JUDI = json_decode(file_get_contents($nombreArchivo,true));
        //* Formateamos los valores del archivo txt para facilitar su posterior tratamiento
        $lista_JUDI = json_decode(json_encode($lista_JUDI), true);
      }else{
        //* El archivo no existe
        $lista_JUDI = array();
      }
      //* Ahora inicializamos todos aquellos juegos que no estén inicializados
      for ($i=0; $i < sizeof($juegos); $i++) { 
        if(isset($lista_JUDI[$i]) && $juegos[$i]['id_videojuego'] == $lista_JUDI[$i]['id_videojuego']){
          //* El juego ya está inicializado
          //* Guardamos su progreso
          $juegos[$i]['completado'] = $lista_JUDI[$i]['completado'];
          $juegos[$i]['fase1'] = $lista_JUDI[$i]['fase1'];
          $juegos[$i]['fase2'] = $lista_JUDI[$i]['fase2'];
          $juegos[$i]['fase3'] = $lista_JUDI[$i]['fase3'];
          $juegos[$i]['fase4'] = $lista_JUDI[$i]['fase4'];
          $juegos[$i]['fase5'] = $lista_JUDI[$i]['fase5'];
          $juegos[$i]['fase6'] = $lista_JUDI[$i]['fase6'];
        }else{
          //* El juego NO está inicializado
          //* Inicializamos el juego
          $juegos[$i]['completado'] = 0;
          $juegos[$i]['fase1'] = 0;
          $juegos[$i]['fase2'] = 0;
          $juegos[$i]['fase3'] = 0;
          $juegos[$i]['fase4'] = 0;
          $juegos[$i]['fase5'] = 0;
          $juegos[$i]['fase6'] = 0;
        }
      }
      //* Ahora actualizamos el archivo txt asociado
      $lista_JUDI_json = json_encode($juegos);
      file_put_contents($nombreArchivo,$lista_JUDI_json);
    }else{
      //* Inicializamos todos los juegos
      for ($i=0; $i < sizeof($juegos); $i++) { 
        $juegos[$i]['completado'] = 0;
        $juegos[$i]['fase1'] = 0;
        $juegos[$i]['fase2'] = 0;
        $juegos[$i]['fase3'] = 0;
        $juegos[$i]['fase4'] = 0;
        $juegos[$i]['fase5'] = 0;
        $juegos[$i]['fase6'] = 0;
      }
      //* Creamos el archivo txt asociado a su id
      $nombreArchivo = '../datos_judi/'.$user_hubgames.'.txt';
      if(!file_exists($nombreArchivo)){
        $lista_JUDI_json = json_encode($juegos);
        file_put_contents($nombreArchivo,$lista_JUDI_json);
      }
    }
  }

  echo json_encode($juegos);
?>