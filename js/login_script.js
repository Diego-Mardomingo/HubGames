$(document).ready(function () {
  

  evento_menu();

  $('.boton_submit').click(function (e) { 
    if(validar_inputs()){
      //* Si los datos de los inputs son válidos
      //* Comprobamos si existe una cuenta creada con ese email
      $.ajax({
        type: "post",
        url: "../ajax/get_usuario.php",
        data: { email: $('#email').val(),
                nocache: Math.random()},
        dataType: "json",
        success: function (response) {
          if(response){
            //* Si que existe una cuenta con ese email
            //* Comprobamos las credenciales del usuario para iniciar sesión
            $.ajax({
              type: "post",
              url: "../ajax/usuarioLogin.php",
              data: {
                nocache: Math.random(),
                email: $('#email').val(),
                pass: $('#pass').val()
              },
              dataType: "json",
              success: function (response) {
                if(response){
                  //* Credenciales correctos
                  //* Inicio de sesión del usuario
                  $.ajax({
                    type: "post",
                    url: "../php/start_sesion.php",
                    data: {
                      nocache: Math.random(),
                      username: response.username,
                      identificador: response.id_usuario
                    },
                    dataType: "json",
                    success: function (response) {
                      if(response){
                        window.location.href = 'https://HubGames.es';
                      }
                    }
                  });
                }else{
                  //* Credenciales incorrectos
                  let error = document.createElement('div');
                  $(error).addClass('error');
                  $(error).html('Email o contraseña incorrectos');
                  $(error).insertAfter('.boton_google');
                }
              },
              error: function(error){
                console.log(error);
              }
            });
          }else{
            //* No existe una cuenta con ese email
            let error = document.createElement('div');
            $(error).addClass('error');
            $(error).html('NO existe una cuenta con ese email');
            $(error).insertAfter('.boton_google');
            
          }
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
      console.log(response);
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
                console.log(response);
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

  $('.error').remove();
  if(!valido){
    let error = document.createElement('div');
    $(error).addClass('error');
    $(error).html(cadenaError);
    $(error).insertAfter('.boton_google');
  }

  return valido;
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