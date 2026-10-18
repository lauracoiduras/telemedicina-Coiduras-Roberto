var express = require("express"); //instacia de la libreria (funcion) a usar => servidor.
var app = express();

// 1. Importar el cliente de Supabase
const { createClient } = require("@supabase/supabase-js");

// 2. Configurar con tu URL y tu Public Key (anon key)
const supabaseUrl = 'https://zdpqividvnudomwsguwc.supabase.co';
const supabaseKey = 'sb_publishable_7FYSxX26z-2Kw0ZUjYZk7w_YTduA0XZ'; // <-- Pega aquí tu public key
const supabase = createClient(supabaseUrl, supabaseKey);

var jwt = require("jwt-simple");
var clave = "miSecretoMasOscuro";


app.use("/apiGestor", express.static("cliente_rest"));
app.use("/apiSanitario", express.static("cliente_rpc"));
app.use(express.json()); //para que Express pueda interpretar los JSON que mandas en los POST y PUT mediante req.body

// Comprobar token JWT
app.use("/api", function (req, res, next) {

    // El login y el registro no necesitan token
    if (req.path === "/gestores/login" ||
        (req.path === "/gestores" && req.method === "POST")) {
        return next();
    }

    var token = req.query.token;

    if (!token) {
        return res.status(401).json("No se ha encontrado token");
    }

    try {
        var contenidoToken = jwt.decode(token, clave);

    } catch (error) {
        return res.status(401).json("El token es incorrecto");
    }

    if (!contenidoToken ||
        !contenidoToken.expira ||
        !contenidoToken.usuario) {
        return res.status(401).json("El formato del token no es adecuado");
    }

    if (contenidoToken.expira < Date.now()) {
        return res.status(401).json("El token ha expirado");
    }

    next();
});

function esNombreOApellidosValido(texto){
  if (texto == null) return false;
  if (typeof texto !== "string") return false;

  var t = texto.trim();
  if (t.length < 2) return false;

  var patron = /^[\p{L}]+(?:[ \-'][\p{L}]+)*$/u;
  return patron.test(t);
}

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/cliente_rest/index.html");
});



/* =========================
   GET: ubicaciones/categorias/modelos
   ========================= */
app.get("/api/ubicaciones", async function (req, res) { //para esperar a que Supabase nos devuelva los datos

  //var sql = "SELECT * FROM ubicaciones";
    const { data: ubicaciones, error: err } = await supabase
    .from("ubicaciones")
    .select("*");

  //conexion.query(sql, function (err, ubicaciones) {
    if (err) {
      console.log("Error al realizar la select", err);
      res.status(500).json("Error al realizar la consulta");   
    } else {
      console.log("Ubicaciones:", ubicaciones);
      res.json(ubicaciones);
    }
  //});
});

app.get("/api/categorias", async function (req, res) {

    const { data: categorias, error: err } = await supabase
        .from("categorias")
        .select("*");
      if (err) {
          console.log("Error al realizar la select", err);
          res.status(500).json("Error al realizar la consulta");
      } else {
          console.log("Categorias:", categorias);
          res.json(categorias);
      }
});


app.get("/api/modelos", async function (req, res) {
    
    const { data: modelos, error: err } = await supabase
        .from("modelos")
        .select("*");
    
      if (err) {
          console.log("Error al realizar la select", err);
          res.status(500).json("Error al realizar la consulta");
      } else {
          console.log("Modelos:", modelos);
          res.json(modelos);
      }
  
});

/* =========================
   POST: login gestor
   Body: { login, password }
   Devuelve: id (número)

   Login correcto
      ↓
   MySQL encuentra al gestor
      ↓
   gestores[0] (objeto gestor)
      ↓
   gestores[0].id (id de ese gestor)
      ↓
   devuelve su ID al cliente
   ========================= */
app.post("/api/gestores/login", async function (req, res) {

  var login = req.body.login;
  var password = req.body.password;
  console.log("Body recibido:", req.body);

    const { data: gestores, error: err } = await supabase
        .from("gestores")
        .select("*")
        .eq("usuario", login)
        .eq("password", password);

    if (err) {
        console.log("Error al realizar la select", err);
        res.status(500).json("Error al realizar la consulta");
    } else {

        if (gestores.length === 1) {

            var contenido = {
                usuario: gestores[0].id,
                //para el token
                expira: Date.now() + 60 * 60 * 1000
            };

            var token = jwt.encode(contenido, clave);

            res.status(200).json({
                id: gestores[0].id,
                token: token
            });

        } else {
            res.status(403).send("Login incorrecto");
        }
    }
  
});


/* =========================
   POST: Crea un nuevo gestor (registro). Se le 
pasa un objeto con los datos del gestor 
(excepto id). El login tiene que ser único.
   ========================= */
app.post("/api/gestores", async function (req, res) {
  var nuevo = req.body;

  if (nuevo == null) return res.status(400).send("Body requerido");

  // Validar campos mínimos
  if (nuevo.nombre == null || nuevo.apellidos == null || nuevo.usuario == null || nuevo.password == null) {
    return res.status(400).send("Faltan campos");
  }

  // Validación nombre/apellidos (sin números ni caracteres raros)
  if (!esNombreOApellidosValido(nuevo.nombre)) {
    return res.status(400).send("Nombre inválido");
  }
  if (!esNombreOApellidosValido(nuevo.apellidos)) {
    return res.status(400).send("Apellidos inválidos");
  }

  // Normalizar guardado
  nuevo.nombre = nuevo.nombre.trim();
  nuevo.apellidos = nuevo.apellidos.trim();

  // Comprobar que el usuario no existe
   const { data: gestores, error: err} = await supabase
        .from("gestores")
        .select("*")
        .eq("usuario", nuevo.usuario);

    if (err) {
        console.log("Error al realizar la select", err);
        return res.status(500).json("Error al realizar la consulta");
    }

    if (gestores.length > 0) {
        return res.status(403).send("Usuario ya existe");
    }


    // Si no existe, crear el gestor
     const { data: resultado, error: errorInsert } = await supabase
        .from("gestores")
        .insert([{
            nombre: nuevo.nombre,
            apellidos: nuevo.apellidos,
            usuario: nuevo.usuario,
            password: nuevo.password
        }])
        .select();

      if (errorInsert) {
          console.log("Error al realizar el insert", errorInsert);
          res.status(500).json("Error al realizar la consulta");
      } else {
          res.status(201).json({  id: resultado[0].id });
      }
});

/* =========================
   PUT: Actualiza los datos del gestor. Se le pasa 
un objeto con los datos a actualizar del 
gestor (excepto id). El login tiene que ser 
único. 
   ========================= */
app.put("/api/gestores/:id", async function (req, res) {
  var id = parseInt(req.params.id);
  var datosUpdate = req.body;
   
  // Buscar el gestor
    const { data: gestores, error: err } = await supabase
            .from("gestores")
            .select("*")
            .eq("id", id); //"... WHERE id = " + id
 
    if (err) {
        console.log("Error al realizar la select", err);
        return res.status(500).json("Error al realizar la consulta");
    }

    // Comprobar que el gestor existe
    if (gestores.length === 0) {
        return res.status(404).send("Gestor no existe");
    }

    var gestor = gestores[0];

    // Validar nombre y apellidos si se quieren modificar
    if (datosUpdate.nombre != null && !esNombreOApellidosValido(datosUpdate.nombre)) {
        return res.status(400).send("Nombre inválido");
    }

    if (datosUpdate.apellidos != null && !esNombreOApellidosValido(datosUpdate.apellidos)) {
        return res.status(400).send("Apellidos inválidos");
    }

    // Si un dato no se quiere modificar, mantenemos el que ya tenía
    if (datosUpdate.nombre == null) datosUpdate.nombre = gestor.nombre;
    if (datosUpdate.apellidos == null) datosUpdate.apellidos = gestor.apellidos;
    if (datosUpdate.usuario == null) datosUpdate.usuario = gestor.usuario;
    if (datosUpdate.password == null) datosUpdate.password = gestor.password;

    datosUpdate.nombre = datosUpdate.nombre.trim();
    datosUpdate.apellidos = datosUpdate.apellidos.trim();

    //Comprobar que el nuevo nombre de usuario que quiere ponerse no lo tenga ya OTRO gestor.
     const { data: gestoresUsuario, error: errUsuario } = await supabase
        .from("gestores")
        .select("*")
        .eq("usuario", datosUpdate.usuario) //igual a
        .neq("id", id); //distinto de 

    if (errUsuario) {
        console.log("Error al realizar la select", errUsuario);
        return res.status(500).json("Error al realizar la consulta");
    }

    if (gestoresUsuario.length > 0) {
        return res.status(403).send("Usuario ya existe");
    }

    // Actualizar el gestor
   const { error: errUpdate } = await supabase
        .from("gestores")
        .update({
            nombre: datosUpdate.nombre,
            apellidos: datosUpdate.apellidos,
            usuario: datosUpdate.usuario,
            password: datosUpdate.password
        })
        .eq("id", id); 

    if (errUpdate) {
        console.log("Error al realizar el update", errUpdate);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.status(200).send("OK");
    } 
});
  

/* =========================
   GET: Obtiene un objeto con los datos de un 
  gestor (no devolver contraseña) 
   ========================= */

app.get("/api/gestores/:id", async function (req, res) {

  var id = parseInt(req.params.id);

  const { data: gestores, error: err } = await supabase
      .from("gestores")
      .select("id, nombre, apellidos, usuario")
      .eq("id", id);

  if (err) {
      console.log("Error al realizar la select", err);
      res.status(500).json("Error al realizar la consulta");
  } else {
      if (gestores.length === 1) {

          res.status(200).json(gestores[0]);
          console.log("gestor: ", gestores[0]);
      } else {
          res.status(404).json("Gestor no existe");
      }
  }

});

/* =========================
   GET: Obtiene un objeto con los datos de un 
  sanitario (no devolver el código de acceso) 
   ========================= */

app.get("/api/sanitarios/:id", async function (req, res) {

  var id = parseInt(req.params.id);

  const { data: sanitarios, error: err } = await supabase
      .from("sanitarios")
      .select("id, nombre, apellidos, usuario")
      .eq("id", id);

  if (err) {
      console.log("Error al realizar la select", err);
      res.status(500).json("Error al realizar la consulta");
  } else {
      if (sanitarios.length === 1) {
          res.status(200).json(sanitarios[0]);
          console.log("sanitario: ", sanitarios[0]);
      } else {
          res.status(404).json("Sanitario no existe");
      }
  }

});
/* =========================
   GET: obtener recursos (con filtros opcionales)
   /api/recursos?categoria=..&modelo=..&ubicacion=..&estado=..
   ========================= */
app.get("/api/recursos", async function (req, res) {

  var categoria = req.query.categoria;  // string o undefined
  var modelo = req.query.modelo;
  var ubicacion = req.query.ubicacion;
  var estado = req.query.estado;

  console.log("GET /api/recursos query:", req.query);

  //var sql = "SELECT recursos.* FROM recursos" +
   //          " INNER JOIN modelos ON recursos.modelo = modelos.id";
  var consulta = supabase
        .from("recursos")
        .select("*, modelos!inner(categoria)");
        //también devuelve los datos de la relación modelos.

  
  // /api/recursos?modelo=1&ubicacion=2
  //var condiciones = [];

  if (categoria != null) {
    //condiciones.push("modelos.categoria = " + categoria);
    consulta = consulta.eq("modelos.categoria", categoria);
  }

  if (modelo != null) {
    consulta = consulta.eq("modelo", modelo);
  }

  if (ubicacion != null) {
    consulta = consulta.eq("ubicacion", ubicacion);
  }

  if (estado != null) {
    consulta = consulta.eq("estado", estado);
  }

  //if (condiciones.length > 0) {sql += " WHERE " + condiciones.join(" AND ");}

  const { data: recursos, error: err } = await consulta;
    
    if (err) {
        console.log("Error al realizar la select", err);
        res.status(500).json("Error al realizar la consulta");
    } else {
        // Devolver únicamente los datos del recurso, sin el objeto adicional modelos.
        recursos.forEach(function (recurso) {
            delete recurso.modelos;
        });
        res.status(200).json(recursos);
    }  
});

/* =========================
   GET: Obtiene los datos de un recurso
   ========================= */
app.get("/api/recursos/:id", async function (req, res) {

  var id = parseInt(req.params.id);

  const { data: recursos, error: err } = await supabase //guarda el resultado en un array llamado recursos
      .from("recursos")
      .select("*")
      .eq("id", id);

  if (err) {
      console.log("Error al realizar la select", err);
      res.status(500).json("Error al realizar la consulta");
  } else {
      if (recursos.length === 1) {
          res.status(200).json(recursos[0]);
      } else {
          res.status(404).json("Recurso no existe");
      }
  }

});

/* =========================
   POST: Crea un recurso 
   ========================= */
app.post("/api/recursos", async function (req, res) {
    
  console.log("POST /api/recursos query:", req.query);
  var nuevo = req.body;

  if (nuevo == null) {
        return res.status(400).send("Body requerido");
  }

  if (nuevo.modelo == null || nuevo.ubicacion == null || nuevo.estado == null) {
    return res.status(400).send("Faltan campos");
  }
  if (nuevo.numero_serie == null || String(nuevo.numero_serie).trim() === "") {
    return res.status(400).send("numero_serie vacío");
  }

  
  nuevo.numero_serie = String(nuevo.numero_serie).trim();


   // Comprobar que numero_serie no existe
    const { data: recursos, error: err } = await supabase
        .from("recursos")
        .select("*")
        .eq("numero_serie", nuevo.numero_serie);
    
      if (err) {
          console.log("Error al realizar la select", err);
          return res.status(500).json("Error al realizar la consulta");
      }
    
      if (recursos.length > 0) {
          return res.status(403).send("numero_serie ya existe");
      }


      // Si no existe, crear el recurso
     const { data: resultado, error: errInsert } = await supabase
        .from("recursos")
        .insert([{
            modelo: nuevo.modelo,
            ubicacion: nuevo.ubicacion,
            numero_serie: nuevo.numero_serie,
            estado: nuevo.estado
        }])
        .select();
    
          if (errInsert) {
              console.log("Error al realizar el insert", errInsert);
              res.status(500).json("Error al realizar la consulta");
          } else {
              //nuevo.id = resultado.insertId;
              nuevo.id = resultado[0].id;
              res.status(201).json(nuevo);
          }
});


/* =========================
   PUT: Actualiza un recurso
   ========================= */
app.put("/api/recursos/:id", async function (req, res) {
  var id = parseInt(req.params.id);
  var datosUpdate = req.body;

  // Buscar el recurso
 const { data: recursos, error: err } = await supabase
        .from("recursos")
        .select("*")
        .eq("id", id);

    if (err) {
        console.log("Error al realizar la select", err);
        return res.status(500).json("Error al realizar la consulta");
    }

    // Comprobar que el recurso existe
    if (recursos.length === 0) {
        return res.status(404).send("Recurso no existe");
    }
  
    var recurso = recursos[0];

    // Validar numero_serie si se quiere modificar
    if (datosUpdate.numero_serie != null) {

        datosUpdate.numero_serie = String(datosUpdate.numero_serie).trim();

        if (datosUpdate.numero_serie === "") {
            return res.status(400).send("numero_serie vacío");
        }
    }
    
    // Si un dato no se quiere modificar, mantenemos el que ya tenía
    if (datosUpdate.modelo == null) datosUpdate.modelo = recurso.modelo;
    if (datosUpdate.ubicacion == null) datosUpdate.ubicacion = recurso.ubicacion;
    if (datosUpdate.numero_serie == null) datosUpdate.numero_serie = recurso.numero_serie;
    if (datosUpdate.estado == null) datosUpdate.estado = recurso.estado;

    // Comprobar que numero_serie no pertenece a otro recurso
     const { data: recursosNumeroSerie, error: errNumeroSerie } = await supabase
            .from("recursos")
            .select("*")
            .eq("numero_serie", datosUpdate.numero_serie)
            .neq("id", id);

        if (errNumeroSerie) {
            console.log("Error al realizar la select", errNumeroSerie);
            return res.status(500).json("Error al realizar la consulta");
        }

        if (recursosNumeroSerie.length > 0) {
                return res.status(403).send("numero_serie ya existe");
        }

        // Actualizar el recurso
    const { error: errUpdate } = await supabase
        .from("recursos")
        .update({
            modelo: datosUpdate.modelo,
            ubicacion: datosUpdate.ubicacion,
            numero_serie: datosUpdate.numero_serie,
            estado: datosUpdate.estado
        })
        .eq("id", id);      
    if (errUpdate) {
        console.log("Error al realizar el update", errUpdate);
        res.status(500).json("Error al realizar la consulta");
    } else {

        // Devolvemos el recurso actualizado
        datosUpdate.id = id;
        res.status(200).json(datosUpdate); //devuelve el objeto entero
    }
});

/* =========================
   DELETE: Borra un recurso

   recursos
    id = 3
      ↑
      ├── reservas con idRecurso = 3
      └── resenyas con idRecurso = 3
   ========================= */

app.delete("/api/recursos/:id", async function (req, res) {
  var id = parseInt(req.params.id);

  // Buscar el recurso
 const { data: recursos, error: err } = await supabase
        .from("recursos")
        .select("*")
        .eq("id", id);
    
    if (err) {
        console.log("Error al realizar la select", err);
        return res.status(500).json("Error al realizar la consulta");
    }

    // Comprobar que el recurso existe
    if (recursos.length === 0) {
        return res.status(404).send("Recurso no existe");
    }

    // Borrar las reservas asociadas al recurso
   const { error: errReservas } = await supabase
        .from("reservas")
        .delete()
        .eq("idrecurso", id);

      if (errReservas) {
          console.log("Error al borrar las reservas", errReservas);
          return res.status(500).json("Error al realizar la consulta");
      }

      // Borrar las reseñas asociadas al recurso
   const { error: errResenyas } = await supabase
        .from("resenyas")
        .delete()
        .eq("idrecurso", id);
    
      if (errResenyas) {
          console.log("Error al borrar las reseñas", errResenyas);
          return res.status(500).json("Error al realizar la consulta");
      }
    
      // Borrar el recurso
      const { error: errRecurso } = await supabase
        .from("recursos")
        .delete()
        .eq("id", id);
      
        if (errRecurso) {
            console.log("Error al borrar el recurso", errRecurso);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.status(200).send("OK");
        }
});


/* =========================
   GET: Obtiene las reservas de un recurso
   ========================= */

app.get("/api/recursos/:id/reservas", async function (req, res) {
  
  var idRecurso = parseInt(req.params.id); //idRecurso = 2 (ejm)

  const { data: reservas, error: err } = await supabase
        .from("reservas")
        .select("*, sanitarios!inner(nombre, apellidos)")
        .eq("idrecurso", idRecurso);

    if (err) {
        console.log("Error al realizar la select", err);
        res.status(500).json("Error al realizar la consulta");
    } else {
        // Añadir el nombre completo del sanitario
        reservas.forEach(function (reserva) {
            reserva.sanitario = reserva.sanitarios.nombre + " " +
                               reserva.sanitarios.apellidos;

            delete reserva.sanitarios;
        });       
        res.status(200).json(reservas);
    }
});



/* =========================
   GET: Obtiene las RESEÑAS de un recurso
   ========================= */


app.get("/api/recursos/:id/resenyas", async function (req, res) {

    var idRecurso = parseInt(req.params.id);

    const { data: resenyas, error: err } = await supabase
        .from("resenyas")
        .select("*, sanitarios!inner(nombre, apellidos)")
        .eq("idrecurso", idRecurso);

    if (err) {
        console.log("Error al realizar la select", err);
        res.status(500).json("Error al realizar la consulta");
    } else {

        resenyas.forEach(function (resenya) {
            resenya.sanitario = resenya.sanitarios.nombre + " " +
                               resenya.sanitarios.apellidos;

            delete resenya.sanitarios;
        });

        res.status(200).json(resenyas);
    }

});



app.listen(3000, function(){ 
    console.log("Servidor REST escuchando en puerto 3000");
});
