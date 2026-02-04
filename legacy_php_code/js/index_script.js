
const key = "e75519d0cc25431bb8cbe4c3dde5c73a";
var fecha_inicio_val='';
var fecha_fin_val='';

$(document).ready(function () {

  buscar_juegos();

  // Funcionalidad del botón de filtros
  // Añade una clase para hacer la animación
  document.querySelector('.boton_filtros').addEventListener('click',()=>{
    if($('.filtros').hasClass('mostrar_filtros')){
      clearTimeout(temp1);
      clearTimeout(temp2);
      $('.filtros').empty();
      $('.filtros').removeClass('mostrar_filtros');
    }else{
      $('.filtros').addClass('mostrar_filtros');
      temp1 = setTimeout(pintar_seleccion_filtros,600);
      temp2 = setTimeout(evento_click_filtros,700);
    }
  });
  
  // Evento boton de buscar pulsado
  document.querySelector('.buscador_boton').addEventListener('click',()=>{
    buscar_juegos();
  });
  // Evento pulsar la tecla intro mientra el focus está en el buscador
  document.querySelector('#buscador_videojuegos').addEventListener('keyup',(e)=>{
    if(e.keyCode===13){
      buscar_juegos();
    }
  });

  // Creación de la X que limpia el buscador
  document.querySelector('#buscador_videojuegos').addEventListener('input',(e)=>{
    if(e.target.value.length >=1){
      $('#limpiar_buscador').css('display', 'block');
      $('#limpiar_buscador').click(function (e) {
        $('#buscador_videojuegos').val('');
        $('#limpiar_buscador').css('display', 'none');
      });
    }else{
      $('#limpiar_buscador').css('display', 'none');
    }
  });

  // Evento para móviles de mostrar el menú
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
    console.log('Adiós');
    $('.nav_list').removeClass('mostrar_menu');
    $('.barras i').removeClass('fa-xmark');
    $('.barras i').addClass('fa-bars');
  })


});

function buscar_juegos(){

  let datos ={
    key: key,
    page_size: 20,
    search: $('#buscador_videojuegos').val(),
    search_exact: 'true',
    exclude_additions: 'true',
    ordering: '-added',
    page: 1
  };

  // Se generan y formatean los filtros de genero
  let generos_activos = document.querySelectorAll('.genero');
  if(generos_activos.length > 0){
    let cadena_generos = '';
    for (let i = 0; i < generos_activos.length-1; i++) {
      cadena_generos += generos_activos[i].id+',';
    }
    cadena_generos += generos_activos[generos_activos.length-1].id;
    cadena_generos = cadena_generos.toLowerCase();
    datos['genres']=cadena_generos;
  }

  // Se generan y formatean los filtros de plataformas
  let plataformas_activos = document.querySelectorAll('.plataforma');
  if(plataformas_activos.length > 0){
    let cadena_plataformas = '';
    for (let i = 0; i < plataformas_activos.length-1; i++) {
      cadena_plataformas += plataformas_activos[i].id+',';
    }
    cadena_plataformas += plataformas_activos[plataformas_activos.length-1].id;
    datos['platforms']=cadena_plataformas;
  }

  // Se generan y formatean los filtros de fecha
  if(fecha_inicio_val === ''){
    // fecha_inicio_val = new Date();
    // fecha_inicio_val.setFullYear(fecha_inicio_val.getFullYear()-3);
    // fecha_inicio_val = fecha_inicio_val.toISOString().split('T')[0];
    fecha_inicio_val = '2000-01-01';
  }
  if(fecha_fin_val === ''){
    // fecha_fin_val = new Date().toISOString().split('T')[0];
    fecha_fin_val = new Date();
    fecha_fin_val.setMonth(fecha_fin_val.getMonth()+6);
    fecha_fin_val = fecha_fin_val.toISOString().split('T')[0];
  }
  datos['dates'] = fecha_inicio_val+','+fecha_fin_val;

  $.ajax({
    type: "get",
    url: "https://api.rawg.io/api/games",
    data: datos,
    dataType: "json",
    success: function (response) {
      pintar_juegos(response.results);
      pintar_paginacion(response);
    }
  });
}  

function pintar_paginacion(response){
  $('.pag_anterior').empty();
  $('.pag_siguiente').empty();
  if(response.next){
    let siguiente_pagina = document.createElement('div');
    $(siguiente_pagina).addClass('siguiente_pagina');
    $(siguiente_pagina).text('Página siguiente');
    $(siguiente_pagina).append('<i class="fa-solid fa-circle-arrow-right"></i>');
    $('.pag_siguiente').append(siguiente_pagina);
    $(siguiente_pagina).click(function (e) { 
      enlace_pagina(response.next);
    });
  }
  if(response.previous){
    let anterior_pagina = document.createElement('div');
    $(anterior_pagina).addClass('anterior_pagina');
    $(anterior_pagina).text('Página anterior');
    $(anterior_pagina).append('<i class="fa-solid fa-circle-arrow-left"></i>');
    $('.pag_anterior').append(anterior_pagina);
    $(anterior_pagina).click(function (e) { 
      enlace_pagina(response.previous);
    });
  }
}
function enlace_pagina(enlace){
  $.ajax({
    type: "get",
    url: enlace,
    data: '',
    dataType: "json",
    success: function (response) {
      pintar_juegos(response.results)
      pintar_paginacion(response);
    }
    
  });
}

function limpiar_juegos(){
  $('.juegos').empty();
  // $('.juegos').children().remove();
}

function pintar_juegos(resultados){
  limpiar_juegos();
  for (let i = 0; i < resultados.length; i++) {
    let div_juego = document.createElement('a');
    $(div_juego).addClass('juego');
    $(div_juego).attr('id', resultados[i].id);
    $(div_juego).attr('href', 'https://Hubgames.es/vistas/detalles_juego_vista.php?id='+resultados[i].id);
    $(div_juego).attr('target', '_blank');
    let div_nombre = document.createElement('div');
    $(div_nombre).addClass('nombre');
    let div_footer = document.createElement('div');
    $(div_footer).addClass('footer_juego');
    let div_released = document.createElement('div');
    $(div_released).addClass('released');
    let div_nota = document.createElement('div');
    $(div_nota).addClass('nota');

    if(resultados[i].metacritic > 80){
      $(div_nota).addClass('fondo_verde');
    }else if(resultados[i].metacritic > 50){
      $(div_nota).addClass('fondo_naranja');
    }else if(resultados[i].metacritic > 0){
      $(div_nota).addClass('fondo_rojo');
    }else{
      $(div_nota).addClass('fondo_transparente');
    }

    let div_imagen = document.createElement('div');
    $(div_imagen).addClass('imagen');

    $(div_nombre).html('<a href="./vistas/detalles_juego_vista.php?id='+resultados[i].id+'">'+resultados[i].name+'</a>');
    $(div_nota).text(resultados[i].metacritic);
    let released = resultados[i].released.split('-');
    $(div_released).text(released[2]+'-'+released[1]+'-'+released[0]);
    $(div_imagen).html('<img class="lazyload" data-sizes="auto" data-srcset="'+resultados[i].background_image+'" alt="Imagen '+resultados[i].name+'">');

    

    $(div_juego).append(div_nombre);
    $(div_juego).append(div_imagen);
    $(div_footer).append(div_released);
    $(div_footer).append(div_nota);
    $(div_juego).append(div_footer);

    $('.juegos').append(div_juego);
  }
}


function evento_click_filtros(){
  document.addEventListener("click", evento_click);
}
function evento_click(e){
  let filtros = document.querySelector('.filtros');
  if (e.target !== filtros && !filtros.contains(e.target)) {
    $('.filtros').empty();
    $('.filtros').removeClass('mostrar_filtros');
    document.removeEventListener('click',evento_click);
  }
}

function pintar_seleccion_filtros(){
  pintar_filtro_fecha();
  pintar_filtros_plataformas();
  pintar_filtros_generos();
}

function pintar_filtro_fecha(){
  let encabezado = document.createElement('div');
  $(encabezado).text('Fecha lanzamiento:');
  $(encabezado).addClass('encabezado_filtros');

  let cuerpo = document.createElement('div');
  $(cuerpo).addClass('cuerpo_filtros_fecha');
  
  let fecha_hoy = new Date();
  fecha_hoy.setMonth(fecha_hoy.getMonth()+6);
  fecha_mas6mes = fecha_hoy.toISOString().split('T')[0]

  let fecha_inicio = document.createElement('div');
  $(fecha_inicio).addClass('fecha_inicio');
  $(fecha_inicio).html('Desde: <input type="date" value="'+fecha_inicio_val+'" min="1990-01-01" max="'+fecha_mas6mes+'">');
  let fecha_fin = document.createElement('div');
  $(fecha_fin).addClass('fecha_fin');
  $(fecha_fin).html('Hasta: <input type="date" value="'+fecha_fin_val+'" min="1990-01-01" max="'+fecha_mas6mes+'">');

  $(cuerpo).append(fecha_inicio);
  $(cuerpo).append(fecha_fin);

  $(fecha_inicio).change(function (e) { 
    fecha_inicio_val = $('.fecha_inicio input').val();
  });
  $(fecha_fin).change(function (e) { 
    fecha_fin_val = $('.fecha_fin input').val();
  });

  let reinicio_fechas = document.createElement('div');
  $(reinicio_fechas).addClass('reinicio_fechas');
  $(reinicio_fechas).append('Reiniciar fechas');
  $(cuerpo).append(reinicio_fechas);
  $(reinicio_fechas).click(function (e) { 
    $('.fecha_inicio input').val('');
    $('.fecha_fin input').val('');
    fecha_inicio_val = '';
    fecha_fin_val = '';
  });

  $('.filtros').append(encabezado);
  $('.filtros').append(cuerpo);
}
function pintar_filtros_generos(){
  let generos = {
    Action:'Acción',
    Indie:'Indie',
    Adventure:'Aventuras',
    RPG:'RPG',
    Strategy:'Estrategia',
    Shooter:'Shooter',
    Simulation:'Simulación',
    Platformer: 'Plataformas'
  };

  let encabezado = document.createElement('div');
  $(encabezado).text('Géneros:');
  $(encabezado).addClass('encabezado_filtros');
  let cuerpo = document.createElement('div');
  $(cuerpo).addClass('cuerpo_filtros');

  for (const key in generos) {
    let genero = document.createElement('div');
    $(genero).addClass('genero');
    $(genero).attr('id', key);
    
    if(document.getElementById(key)){
      $(genero).addClass('filtro_activado');
      $(genero).text(generos[key]);
    }else{
      $(genero).text(generos[key]);
    }

    $(cuerpo).append(genero);

    genero.addEventListener('click',(e)=>{
      evento_filtro_seleccionado(e);
    });
  }

  $('.filtros').append(encabezado);
  $('.filtros').append(cuerpo);
}
function pintar_filtros_plataformas(){

  let plataformas = {
    4:'PC',
    187: 'PlayStation 5',
    18: 'PlayStation 4',
    16: 'PlayStation 3',
    15: 'PlayStation 2',
    27: 'PlayStation',
    19: 'PS Vita',
    17: 'PSP',
    1: 'Xbox One',
    186: 'Xbox Series S/X',
    14: 'Xbox 360',
    80: 'Xbox',
    7: 'Nintendo Switch',
    8: 'Nintendo 3DS',
    9: 'Nintendo DS',
    21: 'Android',
    3: 'iOS',
  };
  let encabezado = document.createElement('div');
  $(encabezado).text('Plataformas:');
  $(encabezado).addClass('encabezado_filtros');
  let cuerpo = document.createElement('div');
  $(cuerpo).addClass('cuerpo_filtros');

  for (const key in plataformas) {
    let plataforma = document.createElement('div');
    $(plataforma).addClass('plataforma');
    $(plataforma).attr('id', key);

    if(document.getElementById(key)){
      $(plataforma).text(plataformas[key]);
      $(plataforma).addClass('filtro_activado');
    }else{
      $(plataforma).text(plataformas[key]);
    }

    $(cuerpo).append(plataforma);

    plataforma.addEventListener('click',(e)=>{
      evento_filtro_seleccionado(e);
    });
  }

  $('.filtros').append(encabezado);
  $('.filtros').append(cuerpo);
}

function evento_filtro_seleccionado(e){
  filtro_objetivo = e.target;
  $(filtro_objetivo).toggleClass('filtro_activado');

  pintar_filtros_activos();
}

function pintar_filtros_activos(){
  $('.filtros_activos_container').empty();
  let filtros_activados = document.querySelectorAll('.filtro_activado');

    for (let i = 0; i < filtros_activados.length; i++) {
      let filtro_activo = document.createElement('div');
      $(filtro_activo).addClass('filtro_activo');
      $(filtro_activo).addClass(filtros_activados[i].classList[0]);
      $(filtro_activo).attr('id', filtros_activados[i].id);
      $(filtro_activo).append('<i class="fa-solid fa-xmark"></i>');
      $(filtro_activo).append(filtros_activados[i].innerText);
      $('.filtros_activos_container').append(filtro_activo);
    }

  boton_borrar_todos_filtros();

  document.querySelectorAll('.fa-xmark').forEach(x => x.addEventListener('click',(e)=>{
    let filtros_activos = document.querySelectorAll('.filtro_activo');
    for (let i = 0; i < filtros_activos.length; i++) {
      if(filtros_activos[i].id === e.target.parentNode.id){
        $(filtros_activos[i]).remove();
      }
    }
    boton_borrar_todos_filtros();
  }));
}

function boton_borrar_todos_filtros(){
  $('#borrar_todos_filtros').remove();
  let filtros_activos = document.querySelectorAll('.filtro_activo');
  if(filtros_activos.length >= 3){
    let borrar_todos_filtros = document.createElement('div');
    $(borrar_todos_filtros).addClass('filtro_activo');
    $(borrar_todos_filtros).attr('id', 'borrar_todos_filtros');
    $(borrar_todos_filtros).append("Borrar filtros");
    $('.filtros_activos_container').append(borrar_todos_filtros);
    $(borrar_todos_filtros).click(function (e) {
      $('.filtros_activos_container').empty();
    });
  }
}

