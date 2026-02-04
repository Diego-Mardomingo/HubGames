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
            $.ajax({
              type: "post",
              url: "../ajax/insertar_usuario.php",
              data: {
                nocache: Math.random(),
                username: $('#username').val(),
                email: $('#email').val(),
                pass: $('#pass').val(),
                email_verificado: 0,
                fecha_creacion: new Date().toISOString().split('T')[0],
                cuenta_google: 0
              },
              dataType: "json",
              success: function (response) {
                if(response){
                  window.location.href = '../vistas/verificar_correo_vista.php?email='+$('#email').val();
                }else{
                }
              },
              error: function(error){
                console.log(error);
              }
            });
          }
        },
        error: function(error){
          console.log(error);
        }
      });
      
    }
  });

});

function googleLogin(credenciales) {
  //* Primero desencriptamos el token de google para acceder a los datos del usuario
  $.ajax({
    type: "post",
    url: "../ajax/googleLogin.php",
    data: { credenciales: credenciales.credential, 
            id_cliente: credenciales.client_id, 
            nocache: Math.random()},
    dataType: "json",
    success: function (response) {
      //* Obtenemos los datos del usuario de google en RESPONSE
      let email_verif = response.email_verified ? 1 : 0;
      let username = response.given_name;
      let email = response.email;
      //* Comprobamos si el usuario ya tiene una cuenta en la base de datos o no
      $.ajax({
        type: "post",
        url: "../ajax/get_usuario.php",
        data: { email: email,
                nocache: Math.random()},
        dataType: "json",
        success: function (response) {
          if(response){
            //* Tiene una cuenta ya creada
            //* Comprobamos si el email está verificado
            if(email_verif === 0){
              //* El email NO está verificado
              window.location.href = '../vistas/verificar_correo_vista.php?email='+email;
            }else{
              //* El email está verificado
              //* Iniciamos sesión con su cuenta de google
              $.ajax({
                type: "post",
                url: "../php/start_sesion.php",
                data: {
                  nocache: Math.random(),
                  username: username,
                  identificador: response.id_usuario
                },
                dataType: "json",
                success: function (response) {
                  window.location.href = 'https://HubGames.es';
                  // if(document.referrer == 'https://hubgames.es/vistas/login_vista.php' || !document.referrer.includes('https://hubgames.es')){
                  //   window.location.href = 'https://HubGames.es';
                  // }else{
                  //   window.history.back();
                  // }
                }
              });
            }
          }else{
            //* No tiene una cuenta ya creada
            //* Creamos la cuenta para el usuario
            $.ajax({
              type: "post",
              url: "../ajax/insertar_usuario.php",
              data: {
                nocache: Math.random(),
                username: username,
                email: email,
                pass: null,
                email_verificado: email_verif,
                fecha_creacion: new Date().toISOString().split('T')[0],
                cuenta_google: 1
              },
              dataType: "json",
              success: function (response) {
                if(response){
                  //* Comprobamos si el email está verificado
                  if(email_verif === 0){
                    //* El email NO está verificado
                    window.location.href = '../vistas/verificar_correo_vista.php?email='+email;
                  }else{
                    //* El email está verificado
                    //* Iniciamos sesión con su cuenta de google
                    $.ajax({
                      type: "post",
                      url: "../php/start_sesion.php",
                      data: {
                        nocache: Math.random(),
                        username: username,
                        identificador: response.id_usuario
                      },
                      dataType: "json",
                      success: function (response) {
                        window.location.href = 'https://HubGames.es';
                        // if(document.referrer == 'https://hubgames.es/vistas/login_vista.php' || !document.referrer.includes('https://hubgames.es')){
                        //   window.location.href = 'https://HubGames.es';
                        // }else{
                        //   window.history.back();
                        // }
                      }
                    });
                  }
                }
              },
              error: function(error){
                console.log(error);
              }
            });
          }
        },
        error: function(error){
          console.log(error);
        }
      });
    },
    error: function(error){
      console.log(error);
    }
  });
}

function evento_menu(){
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
