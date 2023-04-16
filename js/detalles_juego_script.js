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
      console.log(response);
    }
  });

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

});

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
  $(juego_description).html(juego.description);
  $('.cuerpo').append(juego_description);

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