<?php
  session_start();
  require_once('../php/database.php');

  $conn = database::conectar();

  $user_hubgames = $_POST['user_hubgames'];
  $fase = $_POST['fase'];
  $id_lista_JUDI = $_POST['id_lista_JUDI'];
  
  if(isset($_SESSION['identificador'])){
    $params = array(':id_usuario'=>$_SESSION['identificador'],':id_lista_JUDI'=>$id_lista_JUDI);
    //* Con sesión iniciada
    if($fase == 'adivinado'){
      $pdo = $conn->prepare("UPDATE JUDI_fases_usuario SET completado = 1 WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      echo json_encode($pdo->rowCount());
    }else if($fase == 'fase6'){
      $pdo = $conn->prepare("UPDATE JUDI_fases_usuario SET completado = 1, fase6 = 1 WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      echo json_encode('fallido');
    }else if($fase == 'fase1'){
      $pdo = $conn->prepare("UPDATE JUDI_fases_usuario SET fase1 = 1 WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      echo json_encode($pdo->rowCount());
    }else if($fase == 'fase2'){
      $pdo = $conn->prepare("UPDATE JUDI_fases_usuario SET fase2 = 1 WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      echo json_encode($pdo->rowCount());
    }else if($fase == 'fase3'){
      $pdo = $conn->prepare("UPDATE JUDI_fases_usuario SET fase3 = 1 WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      echo json_encode($pdo->rowCount());
    }else if($fase == 'fase4'){
      $pdo = $conn->prepare("UPDATE JUDI_fases_usuario SET fase4 = 1 WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      echo json_encode($pdo->rowCount());
    }else if($fase == 'fase5'){
      $pdo = $conn->prepare("UPDATE JUDI_fases_usuario SET fase5 = 1 WHERE id_lista_JUDI = :id_lista_JUDI AND id_usuario = :id_usuario");
      $pdo->execute($params);
      echo json_encode($pdo->rowCount());
    }
  }else{
    //* Sin sesión iniciada
    $user = $user_hubgames;
    $nombreArchivo = '../datos_judi/'.$user.'.txt';
    $juegos = json_decode(file_get_contents($nombreArchivo,true));
    //* Formateamos los valores del archivo txt para facilitar su posterior tratamiento
    $juegos = json_decode(json_encode($juegos), true);
    for ($i=0; $i < sizeof($juegos); $i++) { 
      if($juegos[$i]['id_lista_JUDI'] == $id_lista_JUDI){

        if($fase == 'adivinado'){
          $juegos[$i]['completado'] = 1;
        }else if($fase == 'fase6'){
          $juegos[$i]['completado'] = 1;
          $juegos[$i]['fase6'] = 1;
        }else if($fase == 'fase1'){
          $juegos[$i]['fase1'] = 1;
        }else if($fase == 'fase2'){
          $juegos[$i]['fase2'] = 1;
        }else if($fase == 'fase3'){
          $juegos[$i]['fase3'] = 1;
        }else if($fase == 'fase4'){
          $juegos[$i]['fase4'] = 1;
        }else if($fase == 'fase5'){
          $juegos[$i]['fase5'] = 1;
        }
        break;
      }
    }
    $lista_JUDI_json = json_encode($juegos);
    file_put_contents($nombreArchivo,$lista_JUDI_json);
    if($fase == 'fase6'){
      echo json_encode('fallido');
    }else{
      echo json_encode($juegos);
    }
  }
?>