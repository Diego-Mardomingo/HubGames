$(document).ready(function () {
  
  evento_moviles();
  let userId = getLocalStorageValue();
  obtener_juegos(userId);

});

function getLocalStorageValue(){
  if(localStorage.getItem('user_hubgames')){
    return localStorage.getItem('user_hubgames');
  }
  const userId = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('user_hubgames',userId);
  return userId;
}

function obtener_juegos(userId){
  $.ajax({
    type: "post",
    url: "../ajax/get_lista_juegos.php",
    data: {
      nocache: Math.random(),
      user_hubgames: userId
    },
    dataType: "json",
    success: function (response) {
      for (let i = 0; i < response.length; i++) {
        let juego = document.createElement('div');
        $(juego).addClass('juego');

        let id_lista = document.createElement('div');
        $(id_lista).addClass('id_lista');
        $(id_lista).text('# '+response[i].id_lista_JUDI);
        $(juego).append(id_lista);

        let fecha = document.createElement('div');
        $(fecha).addClass('fecha');
        $(fecha).text(response[i].fecha);
        $(juego).append(fecha);

        let boton = document.createElement('div');
        $(boton).addClass('boton');
        if(response[i].completado == 0 && response[i].fase6 == 0){
          //* Juego no terminado
          $(boton).addClass('fondo_blanco');
          $(boton).html('<span>¡Jugar!</span> <i class="fa-solid fa-arrow-right"></i>');
          $(boton).click(function (e) { 
            window.location.href = 'https://hubgames.es/vistas/juego_JUDI_vista.php?id_lista='+response[i].id_lista_JUDI;
          });
        }else if(response[i].completado == 1 && response[i].fase6 == 0){
          //* Juego acertado
          $(boton).addClass('fondo_verde');
          $(boton).html('<i class="fa-solid fa-check"></i>');
        }else if(response[i].completado == 1 && response[i].fase6 == 1){
          //* Juego fallado
          $(boton).addClass('fondo_rojo');
          $(boton).html('<i class="fa-solid fa-xmark"></i>');
        }
        $(juego).append(boton);


        $('.lista').append(juego);
      }
    },
    error: function(error){
      console.log(error);
    }
  });
}

function evento_moviles(){
  document.querySelector('.barras').addEventListener('click',()=>{
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
    $('.nav_list').removeClass('mostrar_menu');
    $('.barras i').removeClass('fa-xmark');
    $('.barras i').addClass('fa-bars');
  })
}