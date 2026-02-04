const key = "e75519d0cc25431bb8cbe4c3dde5c73a";
$(document).ready(function () {
  
  let params = new URLSearchParams(location.search);
  let id_juego = params.get('id');

  $.ajax({
    type: "get",
    url: "https://api.rawg.io/api/games/"+id_juego,
    data: {key: key},
    dataType: "json",
    success: function (response) {
      pintar_datos_juego(response);
      obtener_reviews_juego(id_juego);
    },
    
  });

  // Evento para móviles de mostrar el menú
  evento_moviles();

  //* Creación de reseñas 
  $('.boton_new_review').click(function (e) { 
    $('.modal').addClass('mostrar');
  });
  $('#cancelar').click(function (e) { 
    $('.modal').removeClass('mostrar');
  });
  $('#crear').click(function (e) { 
    if(validar_inputs()){
      $.ajax({
        type: "post",
        url: "../ajax/crear_review.php",
        data: {
          nocache: Math.random(),
          encabezado: $('#encabezado').val(),
          contenido: $('#contenido').val(),
          valoracion: $('#valoracion').val(),
          id_juego: id_juego
        },
        dataType: "json",
        success: function (response) {
          location.reload();
        }
      });
    }
  });

});

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

  // Validar cantidad de palabras
  // Máximo para el encabezado 75 caracteres
  let caracteresEncabezado = $('#encabezado').val().trim().split("");
  if (caracteresEncabezado.length > 75) {
    valido = false;
    cadenaError += 'El encabezado excede los 75 caracteres máximos ('+caracteresEncabezado.length+').<br>';
  }

  // Máximo para el contenido 300 caracteres
  let caracteresContenido = $('#contenido').val().trim().split("");
  if (caracteresContenido.length > 300) {
    valido = false;
    cadenaError += 'El contenido excede los 300 caracteres máximos ('+caracteresContenido.length+').<br>';
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

function pintar_datos_juego(juego){
  pintar_nombre(juego);
  pintar_imagen(juego);
  pintar_description(juego);
  pintar_plataformas(juego);
  pintar_generos(juego);
  if(juego.esrb_rating){pintar_edades(juego);}
  if(juego.metacritic){pintar_metacritic(juego);}
  if(juego.playtime){pintar_playtime(juego);}
  pintar_fechas(juego);
  pintar_tags(juego);
  pintar_stores(juego);
  pintar_developers(juego);
  pintar_publishers(juego);
  pintar_enlaces();
  if(juego.website){pintar_website(juego);}
  if(juego.metacritic_url){pintar_enlace_metacritic(juego);}
  if(juego.reddit_url){pintar_enlace_reddit(juego);}
}

function obtener_reviews_juego(id_juego){
  //* Obtenemos todas las reviews asociadas a este videojuego
  $.ajax({
    type: "post",
    url: "../ajax/get_reviews.php",
    data: {
      nocache: Math.random(),
      id_juego: id_juego
    },
    dataType: "json",
    success: function (response) {
      pintar_reviews_juego(response,0);
    }
  });
}

function pintar_reviews_juego(reviews,pagina){
  $('.div_review').empty();

  let num_reviews_pagina = 3;
  let inicio = pagina * 3;
  let fin = inicio + num_reviews_pagina;

  for (let i = inicio; i < fin && i < reviews.length; i++) {

    let div_review = document.createElement('div');
    $(div_review).addClass('review');
    
    let div_encabezado = document.createElement('div');
    $(div_encabezado).addClass('encabezado');
    $(div_encabezado).text(reviews[i].encabezado);
    $(div_review).append(div_encabezado);
    
    let div_contenido = document.createElement('div');
    $(div_contenido).addClass('contenido');
    $(div_contenido).text(reviews[i].contenido);
    $(div_review).append(div_contenido);
    
    let div_fecha_creacion = document.createElement('div');
    $(div_fecha_creacion).addClass('fecha_creacion');
    $(div_fecha_creacion).text(reviews[i].fecha_creacion);
    $(div_review).append(div_fecha_creacion);

    let div_usuario = document.createElement('div');
    $(div_usuario).addClass('usuario');
    let id_usuario = document.createElement('div');
    $(id_usuario).addClass('id_usuario');
    $(id_usuario).text('#'+reviews[i].id_usuario);
    $(div_usuario).append(id_usuario);
    let username = document.createElement('div');
    $(username).addClass('username');
    $(username).text(reviews[i].username);
    $(div_usuario).append(username);
    $(div_review).append(div_usuario);

    let div_valoracion = document.createElement('div');
    $(div_valoracion).addClass('valoracion');
    for (let j = 1; j <= 5; j++) {
      if(j <= reviews[i].valoracion){
        $(div_valoracion).append('<i class="fa-solid fa-star"></i>');
      }else{
        $(div_valoracion).append('<i class="fa-regular fa-star"></i>');
      }
    }
    $(div_review).append(div_valoracion);

    $('.div_review').append(div_review);

  }

  if(reviews.length === 0){
    $('.reviews').append('<div class="review no_reviews">Aún no existen reviews de este videojuego, puedes romper el hielo!</div>');
  }

  let paginacion = document.createElement('div');
  $(paginacion).addClass('paginacion');
  if(fin < reviews.length){
    let siguiente_review = document.createElement('div');
    $(siguiente_review).addClass('siguiente_review');
    $(siguiente_review).html('Siguiente <i class="fa-solid fa-circle-arrow-right"></i>');
    $(siguiente_review).click(function (e) { 
      pagina++;
      pintar_reviews_juego(reviews,pagina);
    });
    $(paginacion).append(siguiente_review);
  }
  if(pagina != 0){
    let anterior_review = document.createElement('div');
    $(anterior_review).addClass('anterior_review');
    $(anterior_review).html('Anterior <i class="fa-solid fa-circle-arrow-left"></i>');
    $(anterior_review).click(function (e) { 
      pagina--;
      pintar_reviews_juego(reviews,pagina);
    });
    $(paginacion).append(anterior_review);
  }
  $('.div_review').append(paginacion);
  
}

function pintar_nombre(juego){
  let juego_name = document.createElement('div');
  $(juego_name).addClass('juego_name');
  $(juego_name).html('<h1>'+juego.name+'</h1>');
  $('.cuerpo').append(juego_name);
}

function pintar_imagen(juego){
  let juego_imagen = document.createElement('div');
  $(juego_imagen).addClass('juego_imagen');
  $(juego_imagen).html('<img src="'+juego.background_image+'">');
  $('.cuerpo').append(juego_imagen);
}

function pintar_description(juego){
  let juego_description = document.createElement('div');
  $(juego_description).addClass('juego_description');
  let idioma_origen = 'en';
  let idioma_destino = 'es';
  let texto = juego.description;
  $.ajax({
    url: "https://translate.googleapis.com/translate_a/single",
    type: "GET",
    data: {
      client: "gtx",
      sl: idioma_origen,
      tl: idioma_destino,
      dt: "t",
      q: texto
    },
    dataType: "json",
    success: function (response) {
      let texto_traducido='';
      for (let i = 0; i < response[0].length; i++) {
        texto_traducido += response[0][i][0];
      }
      $('.cuerpo').append(juego_description);
      $(juego_description).html(texto_traducido);
    }
  });
  // $(juego_description).html(juego.description);
  // $('.cuerpo').append(juego_description);

}

function pintar_plataformas(juego){
  let juego_plataformas = document.createElement('div');
  $(juego_plataformas).addClass('juego_plataformas');
  let titulo_plataformas = document.createElement('div');
  $(titulo_plataformas).addClass('titulo_plataformas');
  $(titulo_plataformas).text('Plataformas');
  $(juego_plataformas).append(titulo_plataformas);
  
  for (let i = 0; i < juego.platforms.length; i++) {
    let nombre_plataforma = document.createElement('div');
    $(nombre_plataforma).addClass('plataforma');
    $(nombre_plataforma).text(juego.platforms[i].platform.name);
    $(juego_plataformas).append(nombre_plataforma);
  }

  $('.cuerpo').append(juego_plataformas);
}

function pintar_generos(juego){
  let juego_generos = document.createElement('div');
  $(juego_generos).addClass('juego_generos');
  let titulo_generos = document.createElement('div');
  $(titulo_generos).text('Géneros');
  $(titulo_generos).addClass('titulo_generos');
  $(juego_generos).append(titulo_generos);

  for (let i = 0; i < juego.genres.length; i++) {
    let nombre_genero = document.createElement('div');
    $(nombre_genero).text(juego.genres[i].name);
    $(nombre_genero).addClass('genero');
    $(juego_generos).append(nombre_genero);
  }

  $('.cuerpo').append(juego_generos);
}

function pintar_edades(juego){
  let juego_edades = document.createElement('div');
  $(juego_edades).addClass('juego_edades');
  switch (juego.esrb_rating.name) {
    case 'Mature':
      $(juego_edades).text('+18');
      $(juego_edades).addClass('fondo_rojo');
      break;
    case 'Everyone':
      $(juego_edades).text('+3');
      $(juego_edades).addClass('fondo_verde');
      break;
    case 'Everyone 10+':
      $(juego_edades).text('+12');
      $(juego_edades).addClass('fondo_naranja');
      break;
    case 'Teen':
      $(juego_edades).text('+16');
      $(juego_edades).addClass('fondo_naranja');
      break;
    case 'Adults Only':
      $(juego_edades).text('+18');
      $(juego_edades).addClass('fondo_rojo');
      break;
    default:
      $(juego_edades).text('?');
      $(juego_edades).addClass('fondo_violeta');
  }

  $('.cuerpo').append(juego_edades);
}

function pintar_metacritic(juego){
  let juego_metacritic = document.createElement('div');
  $(juego_metacritic).addClass('juego_metacritic');
  $(juego_metacritic).text(juego.metacritic);

  if(juego.metacritic > 80){
    $(juego_metacritic).addClass('fondo_verde');
  }else if(juego.metacritic > 50){
    $(juego_metacritic).addClass('fondo_naranja');
  }else if(juego.metacritic > 0){
    $(juego_metacritic).addClass('fondo_rojo');
  }else{
    $(juego_metacritic).addClass('fondo_transparente');
  }

  $('.cuerpo').append(juego_metacritic);
}

function pintar_playtime(juego){
  let juego_playtime = document.createElement('div');
  $(juego_playtime).addClass('juego_playtime');
  $(juego_playtime).html('<div>Promedio horas de juego</div><div class="horas">'+juego.playtime+'</div>');

  $('.cuerpo').append(juego_playtime);
}

function pintar_fechas(juego){
  let juego_fechas = document.createElement('div');
  $(juego_fechas).addClass('juego_fechas');
  let released = document.createElement('div');
  $(released).addClass('released');
  let fecha_released = juego.released.split('-');
  $(released).html('<div>Fecha lanzamiento:</div><div>'+fecha_released[2]+'-'+fecha_released[1]+'-'+fecha_released[0]+'</div>');
  $(juego_fechas).append(released);
  let updated = document.createElement('div');
  $(updated).addClass('updated');
  let fecha_updated = juego.updated.split("T")[0].split('-');
  $(updated).html('<div>Fecha última actualización:</div><div>'+fecha_updated[2]+'-'+fecha_updated[1]+'-'+fecha_updated[0]+'</div>');
  $(juego_fechas).append(updated);

  $('.cuerpo').append(juego_fechas);
}

function pintar_tags(juego){
  let juego_tags = document.createElement('div');
  $(juego_tags).addClass('juego_tags');
  let titulo_tags = document.createElement('div');
  $(titulo_tags).addClass('titulo_tags');
  $(titulo_tags).text('Etiquetas');
  $(juego_tags).append(titulo_tags);
  for (let i = 0; i < juego.tags.length; i++) {
    let tag = document.createElement('div');
    $(tag).text(juego.tags[i].name);
    $(tag).addClass('tag');
    $(juego_tags).append(tag);
  }
  $('.cuerpo').append(juego_tags);
}

function pintar_stores(juego){
  let juego_stores = document.createElement('div');
  $(juego_stores).addClass('juego_stores');
  let titulo_stores = document.createElement('div');
  $(titulo_stores).addClass('titulo_stores');
  $(titulo_stores).text('Tiendas disponibles');
  $(juego_stores).append(titulo_stores);
  for (let i = 0; i < juego.stores.length; i++) {
    let store = document.createElement('div');
    $(store).addClass('store');
    $(store).html('<a href="http://'+juego.stores[i].store.domain+'" target="_blank" rel="noopener noreferrer">'+juego.stores[i].store.name+'<i class="fa-solid fa-arrow-up-right-from-square"></i></a>');
    $(juego_stores).append(store);
  }
  $('.cuerpo').append(juego_stores);
}

function pintar_website(juego){
  let juego_website = document.createElement('div');
  $(juego_website).addClass('juego_website');
  $(juego_website).html('<a href="'+juego.website+'" target="_blank" rel="noopener noreferrer">Página oficial del juego<i class="fa-solid fa-arrow-up-right-from-square"></i></a>');
  $('.cuerpo').append(juego_website);
}

function pintar_developers(juego){
  let juego_developers = document.createElement('div');
  $(juego_developers).addClass('juego_developers');
  let titulo_developers = document.createElement('div');
  $(titulo_developers).addClass('titulo_developers');
  $(titulo_developers).text('Desarrolladores');
  $(juego_developers).append(titulo_developers);
  for (let i = 0; i < juego.developers.length; i++) {
    let developer = document.createElement('div');
    $(developer).addClass('developer');
    $(developer).text(juego.developers[i].name);
    $(juego_developers).append(developer);
  }
  $('.cuerpo').append(juego_developers);
}

function pintar_publishers(juego){
  let juego_publis = document.createElement('div');
  $(juego_publis).addClass('juego_publis');
  let titulo_publis = document.createElement('div');
  $(titulo_publis).addClass('titulo_publis');
  $(titulo_publis).text('Editores');
  $(juego_publis).append(titulo_publis);
  for (let i = 0; i < juego.publishers.length; i++) {
    let publi = document.createElement('div');
    $(publi).addClass('publisher');
    $(publi).text(juego.publishers[i].name);
    $(juego_publis).append(publi);
  }
  $('.cuerpo').append(juego_publis);
}

function pintar_enlaces(){
  let enlaces = document.createElement('div');
  $(enlaces).addClass('enlaces');
  $('.cuerpo').append(enlaces);
}

function pintar_enlace_metacritic(juego){
  let juego_enlace_meta = document.createElement('div');
  $(juego_enlace_meta).addClass('juego_enlace_metacritic');
  $(juego_enlace_meta).html('<a href="'+juego.metacritic_url+'" target="_blank" rel="noopener noreferrer">'+'<img src="../img/Metacritic_logo.svg.png">'+'<i class="fa-solid fa-arrow-up-right-from-square"></i></a>');
  $('.enlaces').append(juego_enlace_meta);
}

function pintar_enlace_reddit(juego){
  let juego_enlace_reddit = document.createElement('div');
  $(juego_enlace_reddit).addClass('juego_enlace_reddit');
  $(juego_enlace_reddit).html('<a href="'+juego.reddit_url+'" target="_blank" rel="noopener noreferrer">'+'<img src="../img/reddit-logo.png">'+'<i class="fa-solid fa-arrow-up-right-from-square"></i></a>');
  $('.enlaces').append(juego_enlace_reddit);
}