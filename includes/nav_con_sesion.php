<div class="nav">
  <a href="https://HubGames.es"><img src="https://HubGames.es/img/HubGamesLogo.webp" title="HubGames" alt="Logo HubGames"></a>
  <div class="barras">Menú <i class="fa-solid fa-bars"></i></div>
  <div class="nav_list">
      <?php 
      if(isset($_SESSION['administrador']) && ($_SESSION['administrador'] == 1)){
        echo '<div class="nav_item"><a href="https://HubGames.es/vistas/administrar_vista.php">Administrar</a></div>';
      } 
      ?>
    <div class="nav_item"><a href="https://HubGames.es">Buscador</a></div>
    <div class="nav_item"><a href="https://HubGames.es/vistas/JUDI_vista.php">JUDI</a></div>
    <div class="nav_item"><a href="https://HubGames.es/vistas/chats_vista.php">Chats</a></div>
    <div class="nav_item">¡Hola <?php echo $_SESSION['username'] ?> 
      <span class="identificador" style="color: #AAA;">#<?php echo $_SESSION['identificador'] ?></span>
    !</div>
    <div class="nav_item"><a href="https://HubGames.es/php/destroy_sesion.php">Cerrar sesión</a></div>
  </div>
</div>