$(document).ready(function () {
  
  evento_menu();

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

function evento_menu(){
  // Evento para móviles de mostrar el menú
  document.querySelector('.barras').addEventListener('click',()=>{
    console.log('Hola');
    $('.nav_list').toggleClass('mostrar_menu');
    if($('.nav_list').hasClass('mostrar_menu')){
      $('.barras i').addClass('fa-xmark');
      $('.barras i').removeClass('fa-bars');
    }else{
      $('.barras i').removeClass('fa-xmark');
      $('.barras i').addClass('fa-bars');
    }
  })
  document.querySelector('.barras').addEventListener('mouseout',()=>{
    console.log('Adiós');
    $('.nav_list').removeClass('mostrar_menu');
    $('.barras i').removeClass('fa-xmark');
    $('.barras i').addClass('fa-bars');
  })
}