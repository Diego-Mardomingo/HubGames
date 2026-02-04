<?php

define("serverhost","localhost");
define("dbname","u365311744_HubGames");
define("user","u365311744_tragico");
define("pass",'0o*X&jJ$EQ~');

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