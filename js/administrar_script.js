$(document).ready(function () {
  
  evento_moviles();

  evento_botones();

});

function evento_botones(){
  $('.boton_logs').click(function (e) { 
    limpiar_clases();
    $('.boton_logs').addClass('seleccionado');
    pintar_logs();
  });
  $('.boton_usuarios').click(function (e) { 
    limpiar_clases();
    $('.boton_usuarios').addClass('seleccionado');
    pintar_usuarios();
  });
  $('.boton_reviews').click(function (e) { 
    limpiar_clases();
    $('.boton_reviews').addClass('seleccionado');
    pintar_reviews();
  });
  $('.boton_chats').click(function (e) { 
    limpiar_clases();
    $('.boton_chats').addClass('seleccionado');
    pintar_chats();
  });
}

function limpiar_clases(){
  $('.boton_logs').removeClass('seleccionado');
  $('.boton_usuarios').removeClass('seleccionado');
  $('.boton_chats').removeClass('seleccionado');
  $('.boton_reviews').removeClass('seleccionado');
}

function pintar_logs(){
  $('.data').empty();
  $.ajax({
    type: "post",
    url: "../ajax/get_all_logs.php",
    data: {
      nocache: Math.random()
    },
    dataType: "json",
    success: function (response) {

      let cabecera = document.createElement('div');
      $(cabecera).addClass('cabecera');
      $(cabecera).text('LOGS');
      $('.data').append(cabecera);

      let div_logs = document.createElement('div');
      $(div_logs).addClass('div_logs');
      
      for (let i = 0; i < response.length; i++) {
        let fila_log = document.createElement('div');
        $(fila_log).addClass('fila_log');
        
        let id_log = document.createElement('div');
        $(id_log).addClass('id_log');
        $(id_log).text('Id log: '+response[i].id_log);
        $(fila_log).append(id_log);

        let evento_log = document.createElement('div');
        $(evento_log).addClass('evento_log');
        $(evento_log).text(response[i].evento);
        pintar_fondo(response[i].evento,fila_log);
        $(fila_log).append(evento_log);

        let fecha_insercion_log = document.createElement('div');
        $(fecha_insercion_log).addClass('fecha_insercion_log');
        $(fecha_insercion_log).text(response[i].fecha_insercion);
        $(fila_log).append(fecha_insercion_log);

        $(div_logs).append(fila_log);
      }

      $('.data').append(div_logs);

    }
  });
}

function pintar_usuarios(){
  $('.data').empty();
  $.ajax({
    type: "post",
    url: "../ajax/get_all_users.php",
    data: {
      nocache: Math.random()
    },
    dataType: "json",
    success: function (response) {

      let cabecera = document.createElement('div');
      $(cabecera).addClass('cabecera');
      $(cabecera).text('USUARIOS');
      $('.data').append(cabecera);

      let div_usuarios = document.createElement('div');
      $(div_usuarios).addClass('div_usuarios');
      
      for (let i = 0; i < response.length; i++) {
        let fila_usuario = document.createElement('div');
        $(fila_usuario).addClass('fila_usuario');
        
        let id_usuario = document.createElement('div');
        $(id_usuario).addClass('id_usuario');
        $(id_usuario).text('#'+response[i].id_usuario);
        $(fila_usuario).append(id_usuario);

        let username = document.createElement('div');
        $(username).addClass('username');
        $(username).text(response[i].username);
        $(fila_usuario).append(username);

        let email = document.createElement('div');
        $(email).addClass('email');
        $(email).text(response[i].email);
        $(fila_usuario).append(email);

        $(div_usuarios).append(fila_usuario);
      }

      $('.data').append(div_usuarios);

    }
  });
}
function pintar_chats(){
  $('.data').empty();
  $.ajax({
    type: "post",
    url: "../ajax/get_chats.php",
    data: {
      nocache: Math.random()
    },
    dataType: "json",
    success: function (response) {

      let cabecera = document.createElement('div');
      $(cabecera).addClass('cabecera');
      $(cabecera).text('CHATS');
      $('.data').append(cabecera);

      let div_chats = document.createElement('div');
      $(div_chats).addClass('div_chats');
      
      for (let i = 0; i < response.length; i++) {
        let fila_chat = document.createElement('div');
        $(fila_chat).addClass('fila_chat');
        
        let id_chat = document.createElement('div');
        $(id_chat).addClass('id_chat');
        $(id_chat).text('Id: '+response[i].id_chat);
        $(fila_chat).append(id_chat);

        let titulo_chat = document.createElement('div');
        $(titulo_chat).addClass('titulo_chat');
        $(titulo_chat).text(response[i].titulo);
        $(fila_chat).append(titulo_chat);

        let fecha_creacion_chat = document.createElement('div');
        $(fecha_creacion_chat).addClass('fecha_creacion_chat');
        $(fecha_creacion_chat).text(response[i].fecha_creacion);
        $(fila_chat).append(fecha_creacion_chat);

        let id_usuario_chat = document.createElement('div');
        $(id_usuario_chat).addClass('id_usuario_chat');
        $(id_usuario_chat).text('Usuario: #'+response[i].id_usuario);
        $(fila_chat).append(id_usuario_chat);

        let ver_comentarios = document.createElement('div');
        $(ver_comentarios).addClass('ver_comentarios');
        $(ver_comentarios).attr('id', response[i].id_chat);
        $(ver_comentarios).html('Ver comentarios <i class="fas fa-comments"></i>');
        $(fila_chat).append(ver_comentarios);

        $(ver_comentarios).click(function (e) { 
          pintar_comentarios($(ver_comentarios).attr('id'));
        });

        let eliminar = document.createElement('div');
        $(eliminar).addClass('eliminar');
        $(eliminar).attr('id', response[i].id_chat);
        $(eliminar).html('Eliminar <i class="fa-solid fa-trash"></i>');
        $(fila_chat).append(eliminar);

        $(eliminar).click(function (e) { 
          let id_chat = $(eliminar).attr('id');
          $.ajax({
            type: "post",
            url: "../ajax/borrar_chat.php",
            data: {
              nocache: Math.random(),
              id_chat: id_chat
            },
            dataType: "json",
            success: function (response) {
              pintar_chats();
            },
            error: function (error){
              console.log(error);
            }
          });
        });

        $(div_chats).append(fila_chat);
      }

      $('.data').append(div_chats);

    }
  });
}
function pintar_comentarios(id_chat){
  $('.data').empty();
  $.ajax({
    type: "post",
    url: "../ajax/get_comentarios.php",
    data: {
      nocache: Math.random(),
      id_chat: id_chat
    },
    dataType: "json",
    success: function (response) {
      let cabecera = document.createElement('div');
      $(cabecera).addClass('cabecera');
      $(cabecera).text('COMENTARIOS');
      $('.data').append(cabecera);
      
      let div_comentarios = document.createElement('div');
      $(div_comentarios).addClass('div_comentarios');

      if(response.length == 0){
        let fila_comentario = document.createElement('div');
        $(fila_comentario).addClass('fila_comentario');
        $(fila_comentario).text('No existen comentarios');
        $(div_comentarios).append(fila_comentario);
      }else{
        for (let i = 0; i < response.length; i++) {
          let fila_comentario = document.createElement('div');
          $(fila_comentario).addClass('fila_comentario');
          
          let id_comentario = document.createElement('div');
          $(id_comentario).addClass('id_comentario');
          $(id_comentario).text('Id: '+response[i].id_comentario);
          $(fila_comentario).append(id_comentario);
  
          let id_usuario_comentario = document.createElement('div');
          $(id_usuario_comentario).addClass('id_usuario_comentario');
          $(id_usuario_comentario).text('Usuario: #'+response[i].id_usuario);
          $(fila_comentario).append(id_usuario_comentario);
  
          let contenido_comentario = document.createElement('div');
          $(contenido_comentario).addClass('contenido_comentario');
          $(contenido_comentario).text(response[i].contenido);
          $(fila_comentario).append(contenido_comentario);
  
          $(div_comentarios).append(fila_comentario);

          let eliminar = document.createElement('div');
          $(eliminar).addClass('eliminar');
          $(eliminar).attr('id', response[i].id_comentario);
          $(eliminar).html('Eliminar <i class="fa-solid fa-trash"></i>');
          $(fila_comentario).append(eliminar);

          $(eliminar).click(function (e) { 
            let id_comentario = $(eliminar).attr('id');
            $.ajax({
              type: "post",
              url: "../ajax/borrar_comentario.php",
              data: {
                nocache: Math.random(),
                id_comentario: id_comentario
              },
              dataType: "json",
              success: function (response) {
                pintar_comentarios(id_chat);
              },
              error: function (error){
                console.log(error);
              }
            });
          });
        }
  
      }
      $('.data').append(div_comentarios);
      
    },
    error: function(error){
      console.log(error);
    }
  });
}
function pintar_reviews(){
  $('.data').empty();
  $.ajax({
    type: "post",
    url: "../ajax/get_all_reviews.php",
    data: {
      nocache: Math.random()
    },
    dataType: "json",
    success: function (response) {

      let cabecera = document.createElement('div');
      $(cabecera).addClass('cabecera');
      $(cabecera).text('RESEÑAS');
      $('.data').append(cabecera);

      let div_reviews = document.createElement('div');
      $(div_reviews).addClass('div_reviews');
      
      for (let i = 0; i < response.length; i++) {
        let fila_review = document.createElement('div');
        $(fila_review).addClass('fila_review');
        
        let id_review = document.createElement('div');
        $(id_review).addClass('id_review');
        $(id_review).text('Id: '+response[i].id_review);
        $(fila_review).append(id_review);

        let encabezado_review = document.createElement('div');
        $(encabezado_review).addClass('encabezado_review');
        $(encabezado_review).text(response[i].encabezado);
        $(fila_review).append(encabezado_review);

        let valoracion = document.createElement('div');
        $(valoracion).addClass('valoracion');
        $(valoracion).text('Nota: '+response[i].valoracion);
        $(fila_review).append(valoracion);

        let fecha_creacion_review = document.createElement('div');
        $(fecha_creacion_review).addClass('fecha_creacion_review');
        $(fecha_creacion_review).text(response[i].fecha_creacion);
        $(fila_review).append(fecha_creacion_review);

        let id_usuario_review = document.createElement('div');
        $(id_usuario_review).addClass('id_usuario_review');
        $(id_usuario_review).text('Usuario: #'+response[i].id_usuario);
        $(fila_review).append(id_usuario_review);

        let eliminar = document.createElement('div');
        $(eliminar).addClass('eliminar');
        $(eliminar).attr('id', response[i].id_review);
        $(eliminar).html('Eliminar <i class="fa-solid fa-trash"></i>');
        $(fila_review).append(eliminar);

        $(eliminar).click(function (e) { 
          let id_review = $(eliminar).attr('id');
          $.ajax({
            type: "post",
            url: "../ajax/borrar_review.php",
            data: {
              nocache: Math.random(),
              id_review: id_review
            },
            dataType: "json",
            success: function (response) {
              pintar_reviews();
            },
            error: function (error){
              console.log(error);
            }
          });
        });

        $(div_reviews).append(fila_review);
      }

      $('.data').append(div_reviews);

    }
  });
}

function pintar_fondo(texto,fila_log){
  if(texto.startsWith('Se ha creado un comentario')){
    $(fila_log).addClass('comentario_creado');
  }else if(texto.startsWith('Se ha creado el usuario')){
    $(fila_log).addClass('usuario_creado');
  }else if(texto.startsWith('Se ha creado un chat')){
    $(fila_log).addClass('chat_creado');
  }else if(texto.startsWith('Se ha creado una reseña')){
    $(fila_log).addClass('review_creado');
  }
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

