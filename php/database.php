<?php

define("serverhost","localhost");
define("dbname","hubgames");
define("user","root");
define("pass","");

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