// rest.get(url, callback)
// rest.post(url, body, callback)
// rest.put(url, body, callback)
// rest.delete(url, callback)
// function callback(estado, respuesta) {...}

    console.log("main.js cargado");
    var seccionActual = "login";
   
    // Guardamos el id del gestor cuando hace login correctamente
    // Si es null, significa que NO hay gestor logueado
    var idGestorActual = null;
    
    //guarda el JWT que devuelve el servidor.
    var tokenGestor = null;

    // Modo del formulario: "registro" o "editar" 
    var modoFormulario = "registro";
    //variables globales para tabla de recursos
    var listaCategorias = [];

    //la que se va acotando segun la categoria
    var listaModelos = [];
    //la que tiene la lista completa de modelos
    var listaModelosCompleta = [];

    var listaUbicaciones = [];

    //PARA RECURSOS
    var idRecursoActual = null;   // null si es nuevo
    var modoRecurso = "nuevo";    // "nuevo" o "editar"

    //Websockets
    var conexionWS = null;

    /*=======================================
      FUNCIÓN PARA CAMBIAR ENTRE PANTALLAS APP (ENTRE DIV)
    ========================================*/
   function cambiarSeccion(seccion){
    console.log("Cambiando de sección:", seccionActual, "->", seccion);
    document.getElementById(seccionActual).classList.remove("activa");
    document.getElementById(seccion).classList.add("activa");
    seccionActual = seccion;


    }

    /*=======================================
      FUNCIÓN PARA VOLVER AL LISTADO: recurso -> inicio, actualizando tabla 
      por si hay cambios de alguno de los recursos
    ========================================*/

    function volverAlListado(){
      cambiarSeccion("inicio");
      buscar(); // repinta la tabla con el recurso actualizado
    }


    /*=======================================
      FUNCIÓN PARA ACCEDER AL INICIO:  LOGIN -> INICIO.
      - método post: api/gestores/login con usuario y 
        password del gestor
    ========================================*/

    function entrar(){
        var usuario = document.getElementById("usuarioLogin").value;
        var password = document.getElementById("passwordLogin").value;
    
        console.log("Intentando login con usuario:", usuario);
    
        fetch("/api/gestores/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                login: usuario,
                password: password
            })
        })
        .then(function(response){
            console.log("Respuesta login status:", response.status);

            if(response.status === 200){
                //return response.text(); (el servidor devuelve "1" como texto (TODO OK))
                return response.json(); //ahora el servidor envia un objeto json
            } else if (response.status === 403){
                throw new Error("Login incorrecto");
            } else {
                throw new Error("Error inesperado en login");
            }
        })
        //.then(function(idTexto){
        //    idGestorActual = parseInt(idTexto);
        //    console.log("Login correcto. idGestorActual =", idGestorActual);

            // Ahora pedimos los datos del gestor
        //    return fetch("/api/gestores/" + idGestorActual);
        //})
        .then(function(datos){        
            // {  "id": 1,
            // "token": "eyJhbGciOiJIUzI1NiIs..." }
            idGestorActual = datos.id;
            tokenGestor = datos.token;

            console.log("Login correcto. idGestorActual =", idGestorActual);
            console.log("Token recibido:", tokenGestor);

            // Ahora pedimos los datos del gestor con el token
            return fetch("/api/gestores/" + idGestorActual);
        })
        .then(function(response){
            return response.json();
        })
        .then(function(gestor){

            console.log("Datos gestor recibidos:", gestor);

            document.getElementById("textoBienvenida").innerHTML =
                "Bienvenido " + gestor.nombre + " " + gestor.apellidos;
            //Websockets
            conectarWebSocketGestor(gestor.nombre + " " + gestor.apellidos);
            cargarFiltros();
            cambiarSeccion("inicio");
            cargarRanking();
            // tabla vacía al entrar
            document.getElementById("tablaRecursos").innerHTML = "";


        })
        .catch(function(error){
            console.log("Fallo login:", error.message);
            alert("Usuario o contraseña incorrectos");
        });
        
    }

    /*=======================================
      FUNCIÓN PARA REGISTRARSE: login -> registro/modificacion de datos.
    ========================================*/

    function registro() {
        console.log("Abriendo formulario de registro");

        modoFormulario = "registro";
        idGestorActual = null;

        document.getElementById("nombreRegistro").value = "";
        document.getElementById("apellidosRegistro").value = "";
        document.getElementById("usuarioRegistro").value = "";
        document.getElementById("passwordRegistro").value = "";
        
    cambiarSeccion("registroModificacion")
    }

    function esNombreOApellidosValido(texto){
      if (texto == null) return false;
      if (typeof texto !== "string") return false;

      var t = texto.trim();
      if (t.length < 2) return false;

      // Solo letras (incluye tildes/ñ), espacios y opcionalmente guion/apóstrofo
      var patron = /^[\p{L}]+(?:[ \-'][\p{L}]+)*$/u;
      return patron.test(t);
    }


     /*=======================================
      FUNCIÓN PARA GUARDAR DATOS DE: registro/modificacion de datos.
      - método post:  /api/gestores para registrar a un nuevo gestor.
      - método put:   /api/gestores para modificar algun dato de gestor ya registrado.
    ========================================*/

    function guardar(){

    var nombre = document.getElementById("nombreRegistro").value;
    var apellidos = document.getElementById("apellidosRegistro").value;
    var usuario = document.getElementById("usuarioRegistro").value;
    var password = document.getElementById("passwordRegistro").value;

    console.log("Guardar. modoFormulario =", modoFormulario);

    // Validación mínima
    if(nombre === "" || apellidos === "" || usuario === "" || password === ""){
        alert("Rellena todos los campos");
        return;
    }

    // Validación nombre y apellidos (sin números ni caracteres raros)
    if (!esNombreOApellidosValido(nombre)) {
      alert("Nombre inválido: solo letras y espacios (sin números ni símbolos)");
      return;
    }
    if (!esNombreOApellidosValido(apellidos)) {
      alert("Apellidos inválidos: solo letras y espacios (sin números ni símbolos)");
      return;
    }

// Normalizar (quita espacios al principio/final)
nombre = nombre.trim();
apellidos = apellidos.trim();

    // CASO 1: REGISTRO NUEVO
    if(modoFormulario === "registro"){

        console.log("POST /api/gestores (registro)");

        fetch("/api/gestores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombre: nombre,
                apellidos: apellidos,
                usuario: usuario,
                password: password
            })
        })
        .then(function(response){
            console.log("Respuesta registro status:", response.status);

            if(response.status === 201){
                return response.json(); // { id: ... }
            }
            else if(response.status === 403){
                throw new Error("Usuario ya existe");
            }
            else{
                throw new Error("Error en registro");
            }
        })
        .then(function(data){
            console.log("Registro correcto. Nuevo id =", data.id);

            alert("Registrado correctamente. Ahora puedes iniciar sesión.");

            cambiarSeccion("login");
        })
        .catch(function(error){
            console.log("Error registro:", error.message);

            if(error.message === "Usuario ya existe"){
                alert("Ese usuario ya existe. Prueba otro.");
            } else {
                alert("Error al registrar");
            }
        });

    }

    // CASO 2: EDITAR DATOS
    else if(modoFormulario === "editar"){

        console.log("PUT /api/gestores/" + idGestorActual);

        fetch("/api/gestores/" + idGestorActual, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre,
            apellidos: apellidos,
            usuario: usuario,
            password: password
          })
        })
        .then(function(response){
          console.log("Respuesta edición status:", response.status);

          if (response.status === 200) {
            return response.text(); // "OK" o "Nada ha sido modificado"
          } else if (response.status === 403) {
            throw new Error("Usuario ya existe");
          } else if (response.status === 404) {
            throw new Error("Gestor no existe");
          } else {
            throw new Error("Error en edición");
          }
        })
        .then(function(txt){
            if (txt === "OK") {
              alert("Datos actualizados correctamente");

              // Volvemos a pedir los datos actualizados del gestor
              fetch("/api/gestores/" + idGestorActual)
                .then(function(r){
                  if (r.status !== 200) throw new Error("No se pudo recargar el gestor");
                  return r.json();
                })
                .then(function(gestor){
                  document.getElementById("textoBienvenida").innerHTML =
                    "Bienvenido " + gestor.nombre + " " + gestor.apellidos;

                  cambiarSeccion("inicio");
                })
                .catch(function(e){
                  console.log(e.message);
                  cambiarSeccion("inicio");
                });

            } 
            else if (txt === "Nada ha sido modificado") {
              alert("Nada ha sido modificado");
            }
          })
        .catch(function(error){
          console.log("Error edición:", error.message);

          if (error.message === "Usuario ya existe") {
            alert("Ese usuario ya existe. Prueba otro.");
          } else if (error.message === "Gestor no existe") {
            alert("Gestor no existe");
          } else {
            alert("Error al actualizar datos");
          }
        });
    }

}

   /*=======================================
      FUNCIÓN PARA CANCELAR: registro/modificacion de datos.
    ========================================*/

    function cancelar(){
      console.log("Cancelar formulario. modoFormulario =", modoFormulario);

      if (modoFormulario === "editar") {
        cambiarSeccion("inicio");
      } else {
        cambiarSeccion("login");
      }
    }

    function datosUsuario(){
        var usuario = document.getElementById("usuarioLogin").value;
        //...
    }

    /*=======================================
      FUNCIÓN PARA SALIR DE LA SESIÓN: de inicio o recurso a login
    ========================================*/

    function salir(){

        console.log("Salir. Cerrando sesión. idGestorActual era:", idGestorActual);

        if (conexionWS != null) {
        conexionWS.close();
        conexionWS = null;
        }

        idGestorActual = null;
        modoFormulario = "registro";
        tokenGestor = null;

        cambiarSeccion("login");
   
    }

    /*=======================================
      FUNCIÓN PARA EDITAR DATOS
    ========================================*/

    function editarDatos(){
    if(idGestorActual == null){
        alert("No hay ningún gestor logueado");
        return;
    }

    console.log("Editar datos de gestor id =", idGestorActual);

    modoFormulario = "editar";

    fetch("/api/gestores/" + idGestorActual)
    .then(function(response){
        console.log("GET gestor status:", response.status);
        if(response.status === 200){
            return response.json();
        } else {
            throw new Error("No se pudo cargar el gestor");
        }
    })
    .then(function(gestor){
        console.log("Datos gestor recibidos:", gestor);

        // Rellenar el formulario con sus datos actuales
        document.getElementById("nombreRegistro").value = gestor.nombre;
        document.getElementById("apellidosRegistro").value = gestor.apellidos;
        document.getElementById("usuarioRegistro").value = gestor.usuario;

        // La contraseña no la devuelve el GET (y mejor así).
        // Tú decides: o la dejas vacía para que la vuelva a escribir:
        document.getElementById("passwordRegistro").value = "";

        cambiarSeccion("registroModificacion");
    })
    .catch(function(error){
        console.log(error.message);
        alert("Error cargando datos del gestor");
    });
}

/*=======================================
      FUNCIÓN PARA CARGAR LOS FILTROS
    ========================================*/


function cargarFiltros() {
  console.log("Cargando filtros...");

  // ESTADO (fijo)
  var selEstado = document.getElementById("filtroEstado");
  selEstado.innerHTML = "";
  selEstado.innerHTML += '<option value="">Todos</option>'; //voy añadiendo las opciones de estado del recurso
  selEstado.innerHTML += '<option value="0">Operativo</option>';
  selEstado.innerHTML += '<option value="1">Baja/defectuoso</option>';
  selEstado.innerHTML += '<option value="2">Mantenimiento</option>';

  // CATEGORÍAS
  fetch("/api/categorias")
    .then(function(r){ return r.json(); })
    .then(function(lista){
      listaCategorias = lista;

      var sel = document.getElementById("filtroCategoria");
      sel.innerHTML = '<option value="">Todos</option>';
      for (var i = 0; i < lista.length; i++) {
        sel.innerHTML += '<option value="' + lista[i].id + '">' + lista[i].nombre + "</option>";
      }

      console.log("Categorías cargadas:", listaCategorias.length);
    });

  // MODELOS
  fetch("/api/modelos")
    .then(function(r){ return r.json(); })
    .then(function(lista){
      listaModelosCompleta = lista;
      listaModelos = lista;
      rellenarSelectModelos(listaModelos);

      console.log("Modelos cargados:", listaModelosCompleta.length);
    });

  // UBICACIONES
  fetch("/api/ubicaciones") 
    .then(function(r){ return r.json(); })
    .then(function(lista){
      listaUbicaciones = lista;
      var sel = document.getElementById("filtroUbicacion");
      sel.innerHTML = '<option value="">Todos</option>';
      for (var i = 0; i < lista.length; i++) {
        sel.innerHTML += '<option value="' + lista[i].id + '">' + lista[i].nombre + "</option>";
      }

      console.log("Ubicaciones cargadas:", listaUbicaciones.length);
    });
}


function rellenarSelectModelos(lista) {
  var sel = document.getElementById("filtroModelo");
  sel.innerHTML = '<option value="">Todos</option>';

  for (var i = 0; i < lista.length; i++) {
    sel.innerHTML += '<option value="' + lista[i].id + '">' + lista[i].nombre + "</option>";
  }
}

function categoriaCambiada() {
  var categoriaSeleccionada = document.getElementById("filtroCategoria").value;
  console.log("Categoría cambiada a:", categoriaSeleccionada);

  // Si es "Todos", se muestran todos los modelos
  if (categoriaSeleccionada === "") {
    listaModelos = listaModelosCompleta;
    rellenarSelectModelos(listaModelos);
    return;
  }

  // Filtrar modelos por esa categoría
  var filtrados = [];
  for (var i = 0; i < listaModelosCompleta.length; i++) {
    if (listaModelosCompleta[i].categoria === parseInt(categoriaSeleccionada)) {
      filtrados.push(listaModelosCompleta[i]);
    }
  }

  listaModelos = filtrados;
  rellenarSelectModelos(listaModelos);

  // (Opcional) resetear el modelo seleccionado
  document.getElementById("filtroModelo").value = "";
}


/*=======================================
      FUNCIÓN PARA CREAR LA TABLA DE RECURSOS
    ========================================*/

function pintarTablaRecursos(lista) {
  var tbody = document.getElementById("tablaRecursos");
  tbody.innerHTML = ""; // limpia la tabla

  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];

    // Sacar modelo y, desde el modelo, la categoría
    var modelo = obtenerModeloPorId(r.modelo);
    var nombreModelo = modelo ? modelo.nombre : "";
    var nombreCategoria = modelo ? obtenerCategoriaNombrePorId(modelo.categoria) : "";

    var nombreUbicacion = obtenerUbicacionNombrePorId(r.ubicacion);
    var textoEstado = estadoATexto(r.estado);

    // usamos r.id internamente, pero NO lo mostramos
    tbody.innerHTML +=
      "<tr>" +
        "<td>" + r.numero_serie + "</td>" +
        "<td>" + nombreCategoria + "</td>" +
        "<td>" + nombreModelo + "</td>" +
        "<td>" + nombreUbicacion + "</td>" +
        "<td>" + textoEstado + "</td>" +
        '<td><button onclick="abrirRecurso(' + r.id + ')">Abrir</button></td>' +
        '<td><button onclick="borrarRecurso(' + r.id + ', \'' + r.numero_serie + '\')">X</button></td>' +
      "</tr>";
  }
}


/*=======================================
      FUNCIÓN PARA BOTON BUSCAR
    ========================================*/

function buscar() {
  console.log("Buscando recursos...");

  var categoria = document.getElementById("filtroCategoria").value;
  var modelo = document.getElementById("filtroModelo").value;
  var ubicacion = document.getElementById("filtroUbicacion").value;
  var estado = document.getElementById("filtroEstado").value;

  var params = [];

  if (categoria !== "") params.push("categoria=" + categoria);
  if (modelo !== "") params.push("modelo=" + modelo);
  if (ubicacion !== "") params.push("ubicacion=" + ubicacion);
  if (estado !== "") params.push("estado=" + estado);

  var url = "/api/recursos";

  if (params.length > 0) {
    url += "?" + params.join("&");
  }

  console.log("URL final:", url);

  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(lista){
      console.log("Recursos recibidos:", lista);
      pintarTablaRecursos(lista);
    });
}


/*=======================================
      FUNCIONES PARA OBTENER MODELO/CATEGORIA/UBICACION DESDE ID
    ========================================*/

function obtenerModeloPorId(idModelo) {
  for (var i = 0; i < listaModelosCompleta.length; i++) {
    if (listaModelosCompleta[i].id === idModelo) return listaModelosCompleta[i];
  }
  return null;
}

function obtenerCategoriaNombrePorId(idCategoria) {
  for (var i = 0; i < listaCategorias.length; i++) {
    if (listaCategorias[i].id === idCategoria) return listaCategorias[i].nombre;
  }
  return "";
}

function obtenerUbicacionNombrePorId(idUbicacion) {
  for (var i = 0; i < listaUbicaciones.length; i++) {
    if (listaUbicaciones[i].id === idUbicacion) return listaUbicaciones[i].nombre;
  }
  return "";
}


function estadoATexto(estado) {
  if (estado === 0) return "Operativo";
  if (estado === 1) return "Baja/defectuoso";
  if (estado === 2) return "Mantenimiento";
  return "";
}

//para rellenar selects segun recurso seleccionado
function rellenarSelectsRecurso() {

  // ---- CATEGORÍAS ----
  var selCat = document.getElementById("selectCategoriaRecurso");
  selCat.innerHTML = "";

  for (var i = 0; i < listaCategorias.length; i++) {
    selCat.innerHTML +=
      '<option value="' + listaCategorias[i].id + '">' +
      listaCategorias[i].nombre +
      "</option>";
  }

  // ---- UBICACIONES ----
  var selUbi = document.getElementById("selectUbicacionRecurso");
  selUbi.innerHTML = "";

  for (var j = 0; j < listaUbicaciones.length; j++) {
    selUbi.innerHTML +=
      '<option value="' + listaUbicaciones[j].id + '">' +
      listaUbicaciones[j].nombre +
      "</option>";
  }

  // ---- MODELOS (según categoría seleccionada) ----
if (listaCategorias.length > 0) {
  selCat.value = String(listaCategorias[0].id);  // fuerza una selección válida
  rellenarModelosSegunCategoria(parseInt(selCat.value));
}
}


// Se ejecuta cuando cambias la categoría 
function categoriaRecursoCambiada() {
  var idCat = parseInt(document.getElementById("selectCategoriaRecurso").value);
  rellenarModelosSegunCategoria(idCat);
}


// Rellena el select de modelos según categoría
function rellenarModelosSegunCategoria(idCategoria) {

  var selMod = document.getElementById("selectModeloRecurso");
  selMod.innerHTML = "";

  for (var i = 0; i < listaModelosCompleta.length; i++) {
    if (listaModelosCompleta[i].categoria === parseInt(idCategoria)) {
      selMod.innerHTML +=
        '<option value="' + listaModelosCompleta[i].id + '">' +
        listaModelosCompleta[i].nombre +
        "</option>";
    }
  }
} 


/* =========================================================
   AÑADIR RECURSO (modo nuevo)
   ========================================================= */

function anadirRecurso() {
  modoRecurso = "nuevo";
  idRecursoActual = null;

  rellenarSelectsRecurso();

  document.getElementById("inputNumeroSerieRecurso").value = "";
  document.getElementById("selectEstadoRecurso").value = "0";

  document.getElementById("tablaReservasRecurso").innerHTML = "";
  document.getElementById("tablaResenyasRecurso").innerHTML = "";

  cambiarSeccion("recurso");
}


/* =========================================================
   ABRIR RECURSO (modo editar)
   ========================================================= */

function abrirRecurso(id) {
  modoRecurso = "editar";
  idRecursoActual = id;

  // 1) Rellenar selects base (categorías/ubicaciones) para que existan opciones
  rellenarSelectsRecurso();

  // 2) Cargar datos del recurso
  fetch("/api/recursos/" + id)
    .then(function (r) {
      if (r.status === 404) throw new Error("Recurso no existe");
      return r.json();
    })
    .then(function (recurso) {
      // --- cargar campos simples ---
      document.getElementById("inputNumeroSerieRecurso").value = recurso.numero_serie;
      document.getElementById("selectUbicacionRecurso").value = String(recurso.ubicacion);
      document.getElementById("selectEstadoRecurso").value = String(recurso.estado);

      // --- ajustar categoría/modelo según el modelo del recurso ---
      var mod = obtenerModeloPorId(recurso.modelo);
      var idCat = mod ? mod.categoria : (listaCategorias.length > 0 ? listaCategorias[0].id : 1);

      document.getElementById("selectCategoriaRecurso").value = String(idCat);
      rellenarModelosSegunCategoria(idCat);
      document.getElementById("selectModeloRecurso").value = String(recurso.modelo);

      // 3) Ahora cargar reservas del recurso
      return fetch("/api/recursos/" + id + "/reservas");
    })
    .then(function (r) {
      return r.json();
    })
    .then(function (listaReservas) {
      pintarReservasRecurso(listaReservas);

      // 4) Ahora cargar reseñas del recurso
      return fetch("/api/recursos/" + id + "/resenyas");
    })
    .then(function (r) {
      return r.json();
    })
    .then(function (listaResenyas) {
      pintarResenyasRecurso(listaResenyas);
     
      // 5) Cuando ya está todo, mostramos la pantalla
      cambiarSeccion("recurso");
    })
    .catch(function (e) {
      alert(e.message);
    });
}


/*=======================================
      FUNCIÓN PARA BOTÓN DE X: BORRAR UN RECURSO COMPLETO
    ========================================*/

function borrarRecurso(id, numeroSerie) {
  if (!confirm("¿Seguro que quieres borrar el recurso " + numeroSerie + "?")) return;

  fetch("/api/recursos/" + id, { method: "DELETE" })
    .then(function(r){
      if (r.status === 200) return r.text();
      if (r.status === 404) throw new Error("Recurso no existe");
      throw new Error("Error borrando recurso");
    })
    .then(function(){
      buscar(); // refresca tabla
    })
    .catch(function(e){
      alert(e.message);
    });
}

/*=======================================
      FUNCIÓN PARA BOTÓN GUARDAR 
    ========================================*/
function guardarRecurso() {
  var idModelo = document.getElementById("selectModeloRecurso").value;
  var idUbicacion = document.getElementById("selectUbicacionRecurso").value;
  var numeroSerie = document.getElementById("inputNumeroSerieRecurso").value;
  var estado = document.getElementById("selectEstadoRecurso").value;

  console.log("[guardarRecurso] modoRecurso =", modoRecurso, 
        "idRecursoActual =", idRecursoActual);

  console.log("[guardarRecurso] datos formulario:", {
        modelo: idModelo,
        ubicacion: idUbicacion,
        numero_serie: numeroSerie,
        estado: estado
      });

  if (numeroSerie.trim() === "") {
    alert("El número de serie no puede estar vacío");
    return;
  }

  var body = {
    modelo: idModelo,
    ubicacion: idUbicacion,
    numero_serie: numeroSerie,
    estado: estado
  };

  // CASO 1: NUEVO
  if (modoRecurso === "nuevo") {

    console.log("[guardarRecurso] POST /api/recursos body =", body);
    fetch("/api/recursos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(function(r){
      console.log("[guardarRecurso][POST] status =", r.status);
      if (r.status === 400) return r.text().then(function(t){ throw new Error(t); });
      if (r.status !== 201 && r.status !== 200) return r.text().then(function(t){ throw new Error(t); });
      return r.json();
    })

    .then(function (nuevo) {
      console.log("[guardarRecurso][POST] recurso creado =", nuevo);
      alert("Recurso creado");
      modoRecurso = "editar";
      idRecursoActual = nuevo.id;

      //Websockets
      if (conexionWS != null) {
        conexionWS.send(JSON.stringify({
          operacion: "nuevoRecurso",
          recurso: nuevo
        }));
      }

      // En un recurso recién creado NO habrá reservas/reseñas
      document.getElementById("tablaReservasRecurso").innerHTML = "";
      document.getElementById("tablaResenyasRecurso").innerHTML = "";

      buscar();
    })
    .catch(function (e) {
      alert("Error creando recurso: " + e.message);
    });

  // CASO 2: EDITAR
  }else {
    console.log("[guardarRecurso] PUT /api/recursos/" + idRecursoActual, "body =", body);
    fetch("/api/recursos/" + idRecursoActual, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    //error
    .then(function(r){
      console.log("[guardarRecurso][PUT] status =", r.status);
      if (r.status === 200) return r.json();
      return r.text().then(function(t){ throw new Error(t); });
    })


    //se ha actualizado el recurso
    .then(function(recursoActualizado){
      console.log("[guardarRecurso][PUT] recurso actualizado =", recursoActualizado);
      alert("Recurso actualizado");
      return fetch("/api/recursos/" + idRecursoActual + "/reservas");
    })

    .then(function(r){
    return r.json();
    })

    //lista de reservas del recurso 
    .then(function(listaReservas){
      pintarReservasRecurso(listaReservas);

      return fetch("/api/recursos/" + idRecursoActual + "/resenyas");
    })
    .then(function(r){
      return r.json();
    })

    //lista de reseñas del recurso
    .then(function(listaResenyas){
      pintarResenyasRecurso(listaResenyas);
    })
    .catch(function(e){
      alert(e.message);
    });
    }
  }

  function pintarReservasRecurso(listaReservas) {
  var tbody = document.getElementById("tablaReservasRecurso");
  tbody.innerHTML = "";

  var ahora = new Date(); // para comparar si va tarde o no

  for (var i = 0; i < listaReservas.length; i++) {
    var r = listaReservas[i];

    // --------- calcular clase según estado ---------
    /*  pendiente: fecha_inicio == null
        en uso: fecha_inicio != null && fecha_fin == null
        finalizada: fecha_fin != null
    */
    var clase = "reserva-finalizada"; // por defecto blanco

    var fIni = (r.fecha_inicio ? new Date(r.fecha_inicio) : null);
    var fFin = (r.fecha_fin ? new Date(r.fecha_fin) : null);

    if (fFin != null) {
      clase = "reserva-finalizada"; // blanco
    } else if (fIni == null) {
      clase = "reserva-pendiente"; // verde
    } else {
      var horas = (r.horas_estimadas != null ? parseFloat(r.horas_estimadas) : 0);
      var limite = new Date(fIni.getTime() + horas * 60 * 60 * 1000);

      if (horas > 0 && ahora > limite) clase = "reserva-en-uso-tarde"; // rojo
      else clase = "reserva-en-uso-ok"; // azul
    }

    // --------- pintar fila de reserva---------
    tbody.innerHTML +=
      '<tr class="' + clase + '">' +
        "<td>" + (r.sanitario || "") + "</td>" +
        "<td>" + (r.horas_estimadas != null ? r.horas_estimadas : "") + "</td>" +
        "<td>" + formatearFecha(r.fecha_peticion) + "</td>" +
        "<td>" + formatearFecha(r.fecha_inicio) + "</td>" +
        "<td>" + formatearFecha(r.fecha_fin) + "</td>" +
      "</tr>";
  }
}


  function pintarResenyasRecurso(listaResenyas) {
    var tbody = document.getElementById("tablaResenyasRecurso");
    tbody.innerHTML = "";

    for (var i = 0; i < listaResenyas.length; i++) {
      var r = listaResenyas[i];

      tbody.innerHTML +=
        "<tr>" +
          "<td>" + formatearFecha(r.fecha) + "</td>" +
          "<td>" + (r.sanitario || "") + "</td>" +
          "<td>" + (r.valor != null ? r.valor : "") + "</td>" +
          "<td>" + (r.descripcion || "") + "</td>" +
        "</tr>";
    }
  }




// Formatea ISO a algo legible
function formatearFecha(valor) {
  if (valor == null || valor === "") return "";
  var d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return d.toLocaleString();
}

//WebSockets
function conectarWebSocketGestor(nombreGestor) {
    conexionWS = new WebSocket("ws://localhost:4444", "avisos");

    conexionWS.addEventListener("open", function () {
        console.log("WebSocket gestor conectado");

        conexionWS.send(JSON.stringify({
            operacion: "identificar",
            tipo: "gestor",
            id: idGestorActual,
            nombre: nombreGestor
        }));
    });

    conexionWS.addEventListener("message", function (msg) {
        var aviso = JSON.parse(msg.data);
        pintarAviso(aviso);
    });

    conexionWS.addEventListener("close", function () {
        console.log("WebSocket gestor cerrado");
    });
}

function pintarAviso(aviso) {
  var tbody = document.getElementById("tablaAvisos");

  var colorFondo = "";

  if (aviso.color === "azul") {
    colorFondo = "background-color: #b9d7ff;";
  } else if (aviso.color === "rojo") {
    colorFondo = "background-color: #ffb3b3;";
  } else if (aviso.color === "verde") {
    colorFondo = "background-color: #b7f7b7;";
  }

  tbody.innerHTML +=
    '<tr style="' + colorFondo + '">' +
      "<td>" + formatearFecha(aviso.fecha) + "</td>" +
      "<td>" + aviso.origen + "</td>" +
      "<td>" + aviso.texto + "</td>" +
    "</tr>";
}



// OBTENER RESERVAS PARA ENVIAR AL MINISTERIO
function enviarReservasMinisterio() {

    // Primero obtenemos todos los recursos
    fetch("/api/recursos")
    .then(function(response) {
        if (!response.ok) {
            throw new Error("Error al obtener recursos");
        }
        return response.json();
    })
    .then(function(recursos) {

        // Por cada recurso, pedimos sus reservas
        var peticiones = recursos.map(function(recurso) {
            return fetch("/api/recursos/" + recurso.id + "/reservas")
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error("Error al obtener reservas");
                    }
                    return response.json();
                });
        });

        // Esperamos a que terminen todas las peticiones
        return Promise.all(peticiones);
    })
    .then(function(listasReservas) {

    var todasReservas = listasReservas.flat();

    console.log("Todas las reservas:", todasReservas);

    // Obtener los datos de cada sanitario
    var peticiones = todasReservas.map(function(reserva) {

        return fetch("/api/sanitarios/" + reserva.idsanitario)
        .then(function(response) {
            if (!response.ok) {
                throw new Error("Error al obtener sanitario");
            }
            return response.json();
        })
        .then(function(sanitario) {

            // Buscar el recurso correspondiente
            return fetch("/api/recursos/" + reserva.idRecurso)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Error al obtener recurso");
                }
                return response.json();
            })
            .then(function(recurso) {

                // Obtener el modelo y la categoría
                var modelo = obtenerModeloPorId(recurso.modelo);

                if (!modelo) {
                    throw new Error("Modelo no encontrado");
                }

                var categoria = obtenerCategoriaNombrePorId(modelo.categoria);

                if (!categoria) {
                    throw new Error("Categoría no encontrada");
                }

                // Crear el objeto con el formato del Ministerio
                return {
                    nombre: sanitario.nombre,
                    apellidos: sanitario.apellidos,
                    "categoría": categoria,
                    horas_estimadas: reserva.horas_estimadas,
                    fec_pet: fechaMinisterio(reserva.fecha_peticion),
                    fec_ini: fechaMinisterio(reserva.fecha_inicio),
                    fecha_fin: fechaMinisterio(reserva.fecha_fin)
                };

            });
        });
    });

    return Promise.all(peticiones);
    })
    .then(function(datos) {

        // Preparar el JSON completo
        var fechaHoy = new Date();

        var envio = {
            id_area: 2,
            fecha: fechaHoy.getFullYear() + "-" +
                  String(fechaHoy.getMonth() + 1).padStart(2, "0") + "-" +
                  String(fechaHoy.getDate()).padStart(2, "0"),
            datos: datos
        };

        //console.log("JSON preparado para el Ministerio:", envio);
        //alert("Preparadas " + datos.length + " reservas para el Ministerio");

        console.log("JSON preparado para el Ministerio:", envio);

        // Enviar el JSON al Ministerio
        fetch("https://undefined.ua.es/telemedicina/api/datos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(envio)
        })
        .then(function(response) {

            if (!response.ok) {
                throw new Error("Error HTTP: " + response.status);
            }

            return response.text();
        })
        .then(function(respuesta) {

            console.log("Respuesta del Ministerio:", respuesta);
            alert("Reservas enviadas correctamente al Ministerio");

            cargarRanking();
        })
        .catch(function(error) {

            console.log("Error al enviar al Ministerio:", error);
            alert("No se han podido enviar las reservas al Ministerio");

        });

    })
    .catch(function(error) {
        console.log(error);
        alert("Error al obtener las reservas");
    });
}


//Esta función transforma las fechas que llegan de MySQL al formato YYYY-MM-DD, manteniendo los valores null
function fechaMinisterio(fecha) {

    if (fecha == null) {
        return null;
    }

    return String(fecha).substring(0, 10);
} 

// OBTENER EL RANKING DE RESERVAS DEL MINISTERIO
function cargarRanking() {

    fetch("https://undefined.ua.es/telemedicina/api/datos")

    .then(function(response) {
        if (!response.ok) {
            throw new Error("Error al obtener datos del Ministerio");
        }
        return response.json();
    })

    .then(function(registros) {

        console.log("Datos del Ministerio:", registros);

        // Contador de reservas por área
        var contador = {};

        // Recorremos todos los registros del Ministerio
        for (var i = 0; i < registros.length; i++) {

            var registro = registros[i];

            var area = registro.id_area;
            var numeroReservas = registro.datos.length;

            if (contador[area] == null) {
                contador[area] = 0;
            }

            contador[area] += numeroReservas;
        }

        // Convertimos el contador en un array
        var ranking = [];

        for (var area in contador) {
            ranking.push({
                id_area: parseInt(area),
                total: contador[area]
            });
        }

        // Ordenar de mayor a menor
        ranking.sort(function(a, b) {
            return b.total - a.total;
        });

        console.log("Ranking:", ranking);

        pintarRanking(ranking);
    })

    .catch(function(error) {
        console.log("Error:", error);
        alert("No se pudo cargar el ranking");
    });
}

// MOSTRAR EL RANKING EN LA TABLA
function pintarRanking(ranking) {

    var nombresAreas = [
        "",
        "Alergología",
        "Anestesiología",
        "Cardiología",
        "Cirugía General",
        "Dermatología",
        "Aparato Digestivo",
        "Endocrinología",
        "Ginecología",
        "Hematología",
        "Medicina Interna",
        "Neumología",
        "Neurología",
        "Oftalmología",
        "Oncología",
        "Pediatría",
        "Psiquiatría",
        "Traumatología",
        "Urología"
    ];

    var tabla = document.getElementById("tablaRanking");

    tabla.innerHTML = "";

    for (var i = 0; i < ranking.length; i++) {

        var area = ranking[i].id_area;
        var nombreArea = nombresAreas[area] || "Área desconocida";

        tabla.innerHTML +=
            "<tr>" +
                "<td>" + (i + 1) + "</td>" +
                "<td>" + nombreArea + "</td>" +
                "<td>" + ranking[i].total + "</td>" +
            "</tr>";
    }
}
