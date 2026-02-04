<?php
echo "Ejecutado<br>";
$dir = '/home/u365311744/domains/hubgames.es/public_html/datos_judi';
$files = scandir($dir);
foreach ($files as $file) {
    if (is_file($dir . '/' . $file)) {
      //! 30 (días) * 24 (horas) * 60 (minutos) * 60 (segundos) EQUIVALE A 30 DÍAS
        if (time() - filemtime($dir . '/' . $file) >  30 * 24 * 60 * 60) {
          echo "Borrado: ".$dir . '/' . $file."<br>";
            unlink($dir . '/' . $file);
        }
    }
}
?>
