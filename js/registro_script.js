$(document).ready(function () {
  
  evento_menu();

  $('.boton_submit').click(function (e) { 
    if(validar_inputs()){
      $.ajax({
        type: "post",
        url: "../ajax/get_usuario.php",
        data: { email: $('#email').val(),
                nocache: Math.random()},
        dataType: "json",
        success: function (response) {
          if(response){
            let error = document.createElement('div');
            $(error).addClass('error');
            $(error).html('Ya existe una cuenta con ese email');
            $(error).insertAfter('.boton_google');
          }else{
            window.location.href = '../vistas/verificar_correo_vista.php?email='+$('#email').val();
          }
        }
      });
      
    }
  });

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

function validar_inputs(){
  let valido = true;
  let cadenaError ='';
  let passRegEx = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]{4,16}$/;
  // pass -> Entre 4 y 16 carácteres, letras y números
  if(!passRegEx.test($('#pass').val())){
    valido = false;
    cadenaError = 'Contraseña no válida.<br> Longitud entre 4 y 16 carácteres.<br> Se permiten letras y números';
  }

  let emailRegEx = /^[a-zA-Z0-9._]+@[a-zA-Z0-9]+.[a-zA-Z]{2,}$/;
  // email -> Debe tener una @ y 1 punto después, éste no puede estar en la primera o última posición del dominio. Permitido letras, números, guiones bajos y puntos.
  if(!emailRegEx.test($('#email').val())){
    valido = false;
    cadenaError = 'Email no válido';
  }

  let usernameRegEx = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ][a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]{3,15}$/;
  // username -> Entre 4 y 16 carácteres, letras, números y guiones bajos, debe comenzar por letra
  if(!usernameRegEx.test($('#username').val())){
    valido = false;
    cadenaError = 'Nombre de usuario no válido.<br> Longitud entre 4 y 16 carácteres y comenzar por letra.<br> Se permiten letras, números y guiones bajos';
  }

  $('.error').remove();
  if(!valido){
    let error = document.createElement('div');
    $(error).addClass('error');
    $(error).html(cadenaError);
    $(error).insertAfter('.boton_google');
  }

  return valido;
}

function mandar_correo_verificacion(){
  $.ajax({
    type: "post",
    url: "",
    data: { nocache: Math.random(),
            username: $('#username').val(),
            email: $('#email').val(),
            pass: $('#pass').val()},
    dataType: "json",
    success: function (response) {
      
    }
  });
}