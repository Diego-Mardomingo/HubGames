$(document).ready(function () {
  

  // Evento para móviles de mostrar el menú
  evento_moviles();

  obtener_chats();

  // Modal para crear un nuevo chat
  $('.boton_new_chat').click(function (e) { 
    $('.modal').addClass('mostrar');
  });
  $('#cancelar').click(function (e) { 
    $('.modal').removeClass('mostrar');
  });
  $('#crear').click(function (e) { 
    if(validar_inputs()){
      console.log('click');
      $.ajax({
        type: "post",
        url: "../ajax/crear_chat.php",
        data: {
          nocache: Math.random(),
          encabezado: $('#encabezado').val(),
          contenido: $('#contenido').val()
        },
        dataType: "json",
        success: function (response) {
          window.location.href = 'https://Hubgames.es/vistas/comentarios_vista.php?id_chat='+response.id_chat;
        }
      });
    }
  });
});

function validar_inputs(){
  let valido = true;
  let cadenaError ='';

  // Validar encabezado
  if($('#encabezado').val().trim() === ''){
    valido = false;
    cadenaError += 'El encabezado no puede estar vacío.<br>';
  }

  // Validar contenido
  if($('#contenido').val().trim() === ''){
    valido = false;
    cadenaError += 'El contenido no puede estar vacío.<br>';
  }

  // Validar cantidad de caracteres
  // Máximo para el encabezado 100 caracteres
  let caracteresEncabezado = $('#encabezado').val().trim().split("");
  if (caracteresEncabezado.length > 100) {
    valido = false;
    cadenaError += 'El titulo excede los 100 caracteres máximos ('+caracteresEncabezado.length+').<br>';
  }

  // Máximo para el contenido 600 caracteres
  let caracteresContenido = $('#contenido').val().trim().split("");
  if (caracteresContenido.length > 600) {
    valido = false;
    cadenaError += 'El contenido excede los 600 caracteres máximos ('+caracteresContenido.length+').<br>';
  }
  

  $('.error').remove();
  if(!valido){
    let error = document.createElement('div');
    $(error).addClass('error');
    $(error).html(cadenaError);
    $(error).insertAfter('.modal-contenido  h2');
  }
  return valido;
}

function obtener_chats(){
  $.ajax({
    type: "post",
    url: "../ajax/get_chats.php",
    data: {
      nocache: Math.random()
    },
    dataType: "json",
    success: function (response) {
      pintar_chats(response,0);
    }
  });
}

function pintar_chats(chats,pagina){

  $('.div_chat').remove();
  $('.paginacion').remove();

  let num_chats_pagina = 4;
  let inicio = pagina * num_chats_pagina;
  let fin = inicio + num_chats_pagina;

  for (let i = inicio; i < fin && i < chats.length; i++) {

    let div_chat = document.createElement('a');
    $(div_chat).addClass('div_chat');
    $(div_chat).attr('href', 'https://HubGames.es/vistas/comentarios_vista.php?id_chat=' + chats[i].id_chat);
  
    let titulo = document.createElement('div');
    $(titulo).addClass('titulo');
    $(titulo).text(chats[i].titulo);
    $(div_chat).append(titulo);

    let contenido = document.createElement('div');
    $(contenido).addClass('contenido');
    $(contenido).text(chats[i].contenido);
    $(div_chat).append(contenido);

    let fecha_creacion = document.createElement('div');
    $(fecha_creacion).addClass('fecha_creacion');
    $(fecha_creacion).text(chats[i].fecha_creacion);
    $(div_chat).append(fecha_creacion);
    
    let ver_comentarios = document.createElement('div');
    $(ver_comentarios).addClass('ver_comentarios');
    $(ver_comentarios).html('Ver comentarios <i class="fa-regular fa-comment"></i>');
    $(div_chat).append(ver_comentarios);

    $('.chats').append(div_chat);
  }


  if(chats.length === 0){
    $('.chats').append('<div class="no_chats">OOOPS! Ha habido un error</div>');
  }

  let paginacion = document.createElement('div');
  $(paginacion).addClass('paginacion');
  if(fin < chats.length){
    let siguiente_chat = document.createElement('div');
    $(siguiente_chat).addClass('siguiente_chat');
    $(siguiente_chat).html('Siguiente página <i class="fa-solid fa-circle-arrow-right"></i>');
    $(siguiente_chat).click(function (e) { 
      pagina++;
      pintar_chats(chats,pagina);
    });
    $(paginacion).append(siguiente_chat);
  }
  if(pagina != 0){
    let anterior_chat = document.createElement('div');
    $(anterior_chat).addClass('anterior_chat');
    $(anterior_chat).html('Anterior página <i class="fa-solid fa-circle-arrow-left"></i>');
    $(anterior_chat).click(function (e) { 
      pagina--;
      pintar_chats(chats,pagina);
    });
    $(paginacion).append(anterior_chat);
  }
  $('.chats').append(paginacion);

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