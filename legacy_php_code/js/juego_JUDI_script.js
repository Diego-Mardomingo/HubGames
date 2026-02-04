var FASE_ACTUAL=0;
$(document).ready(function () {
  
  let params = new URLSearchParams(location.search);
  let id_lista = params.get('id_lista');

  evento_moviles();
  let userId = getLocalStorageValue();
  obtener_datos_juego(id_lista, userId);

});

function getLocalStorageValue(){
  if(localStorage.getItem('user_hubgames')){
    return localStorage.getItem('user_hubgames');
  }
  const userId = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('user_hubgames',userId);
  return userId;
}

function obtener_datos_juego(id_lista, userId){
  $.ajax({
    type: "post",
    url: "../ajax/get_datos_juego.php",
    data: {
      nocache: Math.random(),
      id_lista_JUDI: id_lista,
      user_hubgames: userId
    },
    dataType: "json",
    success: function (response) {
      pintar_fase_inicial(response, userId);
    },
    error: function (error) {
      console.log(error);
    }
  });
}

function pintar_fase_inicial(response, userId){
  
  //* CABECERA 
  let cabecera = document.createElement('div');
  $(cabecera).addClass('cabecera');

  let boton_volver = document.createElement('div');
  $(boton_volver).addClass('boton_volver');
  $(boton_volver).html('<i class="fa-solid fa-arrow-left"></i>Volver');
  $(cabecera).append(boton_volver);
  $(boton_volver).click(function (e) { 
    window.location.href = 'https://hubgames.es/vistas/JUDI_vista.php';
  });

  let fecha = document.createElement('div');
  $(fecha).addClass('fecha');
  $(fecha).text('Juego del día: '+response.juego.fecha+' #'+response.juego.id_lista_JUDI);
  $(cabecera).append(fecha);

  $('.cuerpo').append(cabecera);

  //* CONTENIDO
  let contenido = document.createElement('div');
  $(contenido).addClass('contenido');
  $('.cuerpo').append(contenido);

  let fases = document.createElement('div');
  $(fases).addClass('fases');
  $(contenido).append(fases);

  let data = document.createElement('div');
  $(data).addClass('data');
  $(contenido).append(data);

  let vidas = document.createElement('div');
  $(vidas).addClass('vidas');
  $(contenido).append(vidas);
  comprobar_fases(fases,response);

  let buscador = document.createElement('div');
  $(buscador).addClass('buscador');
  $(buscador).html('<input type="text" placeholder="Escribir">');
  $(contenido).append(buscador);
  let opciones = document.createElement('div');
  $(opciones).addClass('opciones');
  $(buscador).append(opciones);
  buscador.addEventListener('focusout',()=>{
    $('.opciones').fadeOut();
  })
  buscador.addEventListener('focusin',()=>{
    $('.opciones').fadeIn();
  })
  let timer;
  buscador.addEventListener('input',()=>{
    clearTimeout(timer);
    timer = setTimeout(() => {
      busqueda_api();
    }, 500);
  })

  let adivinar = document.createElement('div');
  $(adivinar).addClass('adivinar');
  $(adivinar).text('Adivinar');
  $(contenido).append(adivinar);
  $(adivinar).click(function (e) { 
    if(($('.buscador input').val()).toUpperCase() == response.juego.nombre.toUpperCase()){
      //* Juego adivinado
      let resultado = response.juego.nombre;
      console.log('userId',userId);
      $.ajax({
        type: "post",
        url: "../ajax/actualizar_fase.php",
        data: {
          nocache: Math.random(),
          fase: 'adivinado',
          id_lista_JUDI: response.juego.id_lista_JUDI,
          user_hubgames: userId
        },
        dataType: "json",
        success: function (response) {
          $('.contenido').empty();
          $('.contenido').html('<div class="acertado">Enhorabuena! El juego del día de hoy es '+resultado+'</div>');
        },
        error: function(error){
          console.log(error);
        }
      });
    }else{
      //* Juego fallado
      FASE_ACTUAL++;
      let id_lista = response.juego.id_lista_JUDI;
      let resultado = response.juego.nombre;
      $.ajax({
        type: "post",
        url: "../ajax/actualizar_fase.php",
        data: {
          nocache: Math.random(),
          fase: 'fase'+(FASE_ACTUAL),
          id_lista_JUDI: response.juego.id_lista_JUDI,
          user_hubgames: userId
        },
        dataType: "json",
        success: function (response) {
          if(response == 'fallido'){
            $('.contenido').empty();
            $('.contenido').html('<div class="fallado">Fallaste! El juego del día de hoy es '+resultado+'</div>');
          }else{
            $('.cuerpo').empty();
            obtener_datos_juego(id_lista,userId);
          }
        },
        error: function(error){
          console.log(error);
        }
      });
    }
  });

}

function pintar_data(fase,response){
  $('.data').empty();
  let imagen = document.createElement('div');
  $(imagen).addClass('imagen');
  let pista = document.createElement('div');
  $(pista).addClass('pista');
  

  switch (fase) {
    case 1:
      $(imagen).html('<img src="'+response.capturas[5]+'">');
      $('.data').append(imagen);
      $('.seleccionado').removeClass('seleccionado');
      $('.fase_inicial').addClass('seleccionado');
      break;
    case 2:
      $(imagen).html('<img src="'+response.capturas[1]+'">');
      $('.data').append(imagen);
      $(pista).html('Popularidad: '+response.juego.desarrollador+'/5');
      $('.data').append(pista);
      $('.seleccionado').removeClass('seleccionado');
      $('.fase1').addClass('seleccionado');
      break;
    case 3:
      $(imagen).html('<img src="'+response.capturas[2]+'">');
      $('.data').append(imagen);
      $(pista).html('Metacritic: '+response.juego.calificacion+'/100');
      $('.data').append(pista);
      $('.seleccionado').removeClass('seleccionado');
      $('.fase2').addClass('seleccionado');
      break;
    case 4:
      $(imagen).html('<img src="'+response.capturas[3]+'">');
      $('.data').append(imagen);
      $(pista).html('Plataformas: '+ response.plataformas.join(', '));
      $('.data').append(pista);
      $('.seleccionado').removeClass('seleccionado');
      $('.fase3').addClass('seleccionado');
      break;
    case 5:
      $(imagen).html('<img src="'+response.capturas[4]+'">');
      $('.data').append(imagen);
      $(pista).html('Géneros: '+ response.generos.join(', '));
      $('.data').append(pista);
      $('.seleccionado').removeClass('seleccionado');
      $('.fase4').addClass('seleccionado');
      break;
    case 6:
      $(imagen).html('<img src="'+response.capturas[0]+'">');
      $('.data').append(imagen);
      $(pista).html('Lanzamiento: '+ response.juego.released);
      $('.data').append(pista);
      $('.seleccionado').removeClass('seleccionado');
      $('.fase5').addClass('seleccionado');
      break;
  }
}

function comprobar_fases(fases, response){
  $('.fases').empty();

  if(response.juego.completado == 1){
    window.location.href = 'https://hubgames.es/vistas/JUDI_vista.php';
  }

  let fase_inicial = document.createElement('div');
  $(fase_inicial).addClass('fase_inicial');
  $(fase_inicial).addClass('fase');
  $(fase_inicial).text('1');
  $(fases).append(fase_inicial); 
  pintar_vidas(6);
  pintar_data(1,response);
  $(fase_inicial).click(function (e) { 
    pintar_data(1,response);
  });

  if(response.juego.fase1 == 1){
    FASE_ACTUAL = 1;
    let fase1 = document.createElement('div');
    $(fase1).addClass('fase');
    $(fase1).addClass('fase1');
    $(fase1).text('2');
    $(fases).append(fase1);
    pintar_vidas(5);
    pintar_data(2,response);
    $(fase1).click(function (e) { 
      pintar_data(2,response);
    });
  }
  if(response.juego.fase2 == 1){
    FASE_ACTUAL = 2;
    let fase2 = document.createElement('div');
    $(fase2).addClass('fase');
    $(fase2).addClass('fase2');
    $(fase2).text('3');
    $(fases).append(fase2);
    pintar_vidas(4);
    pintar_data(3,response);
    $(fase2).click(function (e) { 
      pintar_data(3,response);
    });
  } 
  if(response.juego.fase3 == 1){
    FASE_ACTUAL = 3;
    let fase3 = document.createElement('div');
    $(fase3).addClass('fase');
    $(fase3).addClass('fase3');
    $(fase3).text('4');
    $(fases).append(fase3);
    pintar_vidas(3);
    pintar_data(4,response);
    $(fase3).click(function (e) { 
      pintar_data(4,response);
    });
  } 
  if(response.juego.fase4 == 1){
    FASE_ACTUAL = 4;
    let fase4 = document.createElement('div');
    $(fase4).addClass('fase');
    $(fase4).addClass('fase4');
    $(fase4).text('5');
    $(fases).append(fase4);
    pintar_vidas(2);
    pintar_data(5,response);
    $(fase4).click(function (e) { 
      pintar_data(5,response);
    });
  } 
  if(response.juego.fase5 == 1){
    FASE_ACTUAL = 5;
    let fase5 = document.createElement('div');
    $(fase5).addClass('fase');
    $(fase5).addClass('fase5');
    $(fase5).text('6');
    $(fases).append(fase5);
    pintar_vidas(1);
    pintar_data(6,response);
    $(fase5).click(function (e) { 
      pintar_data(6,response);
    });
  }
}

function pintar_vidas(numVidas){
  $('.vidas').empty();
  for (let i = 0; i < 6; i++) {
    if(i < numVidas){
      $('.vidas').append('<div><i class="fa-solid fa-heart"></i></div>');
    }else{
      $('.vidas').append('<div><i class="fa-regular fa-heart"></i></div>');
    }
  }
}

function busqueda_api(){
  let apiKey = '3b597a76023d49faa0deba195b7b78b7';
  let hoy = new Date().toISOString().split('T')[0]
  menos10años = new Date();
  menos10años.setFullYear(menos10años.getFullYear()-10);
  menos10años = menos10años.toISOString().split('T')[0];
  if($('.buscador input').val() != '' && $('.buscador input').val().length > 2){
    $.ajax({
      type: "get",
      url: "https://api.rawg.io/api/games",
      data: {
        key: apiKey,
        exclude_additions: 'true',
        dates: menos10años+','+hoy,
        search: $('.buscador input').val()
      },
      dataType: "json",
      success: function (response) {
        $('.opciones').empty();
        for (let i = 0; i < response['results'].length; i++) {
          $('.opciones').append('<div>'+response['results'][i].name+'</div>');
        }
        $('.opciones div').click(function (e) { 
          $('.buscador input').val(e.target.innerHTML);
        });
      }
    });
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