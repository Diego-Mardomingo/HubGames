$(document).ready(function () {
  


});

function googleLogin(credenciales) {
  $.ajax({
    type: "post",
    url: "../ajax/googleLogin.php",
    data: { credenciales: credenciales.credential, 
            id_cliente: credenciales.client_id, 
            nocache: Math.random()},
    dataType: "json",
    success: function (response) {
      console.log(response);
    },
    error: function(error){
      console.log("Ha ocurrido un error");
      console.log(error);
    }
  });
}