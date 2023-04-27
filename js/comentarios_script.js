$(document).ready(function () {
  
  // Boton de volver
  $('.boton_volver').click(function (e) { 
    window.history.back();
  });

  // Evento para móviles de mostrar el menú
  evento_moviles();

  let params = new URLSearchParams(location.search);
  let id_chat = params.get('id_chat');
  pintar_chat(id_chat);
  obtener_comentarios(id_chat);

  $('.boton_new_comentario').click(function (e) { 
    $('.modal').addClass('mostrar');
  });
  $('#cancelar').click(function (e) { 
    $('.modal').removeClass('mostrar');
  });
  $('#crear').click(function (e) { 
    if(validar_inputs()){
      $.ajax({
        type: "post",
        url: "../ajax/crear_comentario.php",
        data: {
          nocache: Math.random(),
          contenido: $('#contenido').val(),
          id_chat: id_chat
        },
        dataType: "json",
        success: function (response) {
          location.reload();
        }
      });
    }
  });

});

function pintar_chat(id_chat){
  $.ajax({
    type: "post",
    url: "../ajax/get_chatId.php",
    data: {
      nocache: Math.random(),
      id_chat: id_chat
    },
    dataType: "json",
    success: function (response) {
      let div_chat = document.createElement('div');
      $(div_chat).addClass('div_chat');
    
      let titulo = document.createElement('div');
      $(titulo).addClass('titulo');
      $(titulo).text(response.titulo);
      $(div_chat).append(titulo);

      let contenido = document.createElement('div');
      $(contenido).addClass('contenido');
      $(contenido).text(response.contenido);
      $(div_chat).append(contenido);

      let fecha_creacion = document.createElement('div');
      $(fecha_creacion).addClass('fecha_creacion');
      $(fecha_creacion).text(response.fecha_creacion);
      $(div_chat).append(fecha_creacion);
      
      let usuario = document.createElement('div');
      $(usuario).addClass('usuario');
      let id_usuario = document.createElement('div');
      $(id_usuario).addClass('id_usuario');
      $(id_usuario).text('#'+response.id_usuario);
      $(usuario).append(id_usuario);
      let username = document.createElement('div');
      $(username).addClass('username');
      $(username).text(response.username);
      $(usuario).append(username);

      $(div_chat).append(usuario);

      $('.chat').append(div_chat);
    }
  });
}

function validar_inputs(){
  let valido = true;
  let cadenaError ='';

  // Validar contenido
  if($('#contenido').val().trim() === ''){
    valido = false;
    cadenaError += 'El contenido no puede estar vacío.<br>';
  }

  // Máximo para el contenido 500 caracteres
  let caracteresContenido = $('#contenido').val().trim().split("");
  if (caracteresContenido.length > 500) {
    valido = false;
    cadenaError += 'El contenido excede los 500 caracteres máximos ('+caracteresContenido.length+').<br>';
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

function obtener_comentarios(id_chat){
  $.ajax({
    type: "post",
    url: "../ajax/get_comentarios.php",
    data: {
      nocache: Math.random(),
      id_chat: id_chat
    },
    dataType: "json",
    success: function (response) {
      pintar_comentarios(response,0);
    },
    error: function(error){
      console.log(error);
    }
  });
}

function pintar_comentarios(comentarios,pagina){

  $('.div_comentario').remove();
  $('.paginacion').remove();

  let num_comentarios_pagina = 4;
  let inicio = pagina * num_comentarios_pagina;
  let fin = inicio + num_comentarios_pagina;

  for (let i = inicio; i < fin && i < comentarios.length; i++) {

    let div_comentario = document.createElement('div');
    $(div_comentario).addClass('div_comentario');

    let contenido = document.createElement('div');
    $(contenido).addClass('contenido');
    $(contenido).text(comentarios[i].contenido);
    $(div_comentario).append(contenido);

    let fecha_creacion = document.createElement('div');
    $(fecha_creacion).addClass('fecha_creacion');
    $(fecha_creacion).text(comentarios[i].fecha_creacion);
    $(div_comentario).append(fecha_creacion);
    
    let usuario = document.createElement('div');
    $(usuario).addClass('usuario');
    let id_usuario = document.createElement('div');
    $(id_usuario).addClass('id_usuario');
    $(id_usuario).text('#'+comentarios[i].id_usuario);
    $(usuario).append(id_usuario);
    let username = document.createElement('div');
    $(username).addClass('username');
    $(username).text(comentarios[i].username);
    $(usuario).append(username);

    $(div_comentario).append(usuario);
    

    $('.comentarios').append(div_comentario);
  }


  if(comentarios.length === 0){
    $('.comentarios').append('<div class="no_comentarios">OOOPS! Aún no hay comentarios en este chat <i class="fa-regular fa-face-frown-open"></i></div>');
  }

  let paginacion = document.createElement('div');
  $(paginacion).addClass('paginacion');
  if(fin < comentarios.length){
    let siguiente_comentario = document.createElement('div');
    $(siguiente_comentario).addClass('siguiente_comentario');
    $(siguiente_comentario).html('Siguiente página <i class="fa-solid fa-circle-arrow-right"></i>');
    $(siguiente_comentario).click(function (e) { 
      pagina++;
      pintar_comentarios(comentarios,pagina);
    });
    $(paginacion).append(siguiente_comentario);
  }
  if(pagina != 0){
    let anterior_comentario = document.createElement('div');
    $(anterior_comentario).addClass('anterior_comentario');
    $(anterior_comentario).html('Anterior página <i class="fa-solid fa-circle-arrow-left"></i>');
    $(anterior_comentario).click(function (e) { 
      pagina--;
      pintar_comentarios(comentarios,pagina);
    });
    $(paginacion).append(anterior_comentario);
  }
  $('.comentarios').append(paginacion);

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