<?php

define("serverhost","localhost");
define("dbname","REMOVED_FOR_SECURITY");
define("user","REMOVED_FOR_SECURITY");
define("pass",'REMOVED_FOR_SECURITY');

class database{

  public static function conectar(){
    try {
      $conn = new PDO("mysql:host=".constant('serverhost').";dbname=".constant('dbname'),constant('user'),constant('pass'));
    } catch (PDOException $e) {
      echo $e->getMessage();
    }
    return $conn;
  }

}
?>