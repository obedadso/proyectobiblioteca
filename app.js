const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const flash = require('express-flash');
const session = require('express-session');
const mysql = require('mysql2');
const connection  = require('./lib/db');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const booksRouter = require('./routes/books');
// const editorialesRouter = require('./routes/editoriales'); // ELIMINA o comenta esta línea

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Aumenta el tiempo de sesión a 30 minutos (1800000 ms)
app.use(session({ 
    cookie: { maxAge: 1800000 }, // 30 minutos
    store: new session.MemoryStore,
    saveUninitialized: true,
    resave: 'true',
    secret: 'secret'
}));

app.use(flash());

// ==================== Middleware para proteger rutas ====================
app.use((req, res, next) => {
  // Permitir acceso libre a /login y /logout
  if (req.path === '/login' || req.path === '/logout' || req.path.startsWith('/public')) {
    return next();
  }
  // Si no hay usuario en sesión, redirige a login
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
});

// ==================== RUTAS DE LOGIN ====================
app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  const { username, password, role } = req.body;
  connection.query(
    'SELECT * FROM usuarios WHERE username = ? AND rol = ?',
    [username, role],
    (err, results) => {
      if (err) {
        req.flash('error', 'Error en la base de datos');
        return res.render('login', { error: 'Error en la base de datos' });
      }
      if (results.length === 0) {
        req.flash('error', 'Usuario, contraseña o rol incorrectos');
        return res.render('login', { error: 'Usuario, contraseña o rol incorrectos' });
      }
      // Comparación simple de contraseña (para producción usa bcrypt)
      if (results[0].password !== password) {
        req.flash('error', 'Usuario, contraseña o rol incorrectos');
        return res.render('login', { error: 'Usuario, contraseña o rol incorrectos' });
      }
      // Guardar sesión
      req.session.user = {
        id: results[0].id,
        username: results[0].username,
        rol: results[0].rol,
        nombre: results[0].nombre
      };

      // Redirección/renderizado según el rol
      if (results[0].rol === 'admin') {
        // Consulta para las cards del dashboard
        connection.query(
          `SELECT 
            (SELECT COUNT(*) FROM libros WHERE estado='Disponible') AS disponibles,
            (SELECT COUNT(*) FROM prestamos WHERE estado='Prestado') AS prestados,
            (SELECT COUNT(*) FROM prestamos WHERE estado='Devuelto') AS devueltos`,
          (err2, results2) => {
            return res.render('index', {
              title: 'Panel de Control',
              user: req.session.user,
              totalDisponibles: results2 && results2[0] ? results2[0].disponibles : 0,
              totalPrestados: results2 && results2[0] ? results2[0].prestados : 0,
              totalDevueltos: results2 && results2[0] ? results2[0].devueltos : 0
            });
          }
        );
      } else if (results[0].rol === 'bibliotecario') {
        res.redirect('/dashboard-bibliotecario');
      } else if (results[0].rol === 'usuario') {
        res.redirect('/dashboard-usuario');
      } else {
        res.redirect('/');
      }
    }
  );
});

// ==================== RUTA LOGOUT ====================
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ==================== DASHBOARD PARA ADMIN ====================
app.get('/', (req, res) => {
  // Solo dashboard si es admin
  if (!req.session.user || req.session.user.rol !== 'admin') {
    return res.redirect('/login');
  }
  connection.query(
    `SELECT 
      (SELECT COUNT(*) FROM libros WHERE estado='Disponible') AS disponibles,
      (SELECT COUNT(*) FROM prestamos WHERE estado='Prestado') AS prestados,
      (SELECT COUNT(*) FROM prestamos WHERE estado='Devuelto') AS devueltos`,
    (err, results) => {
      res.render('index', {
        title: 'Panel de Control',
        user: req.session.user,
        totalDisponibles: results && results[0] ? results[0].disponibles : 0,
        totalPrestados: results && results[0] ? results[0].prestados : 0,
        totalDevueltos: results && results[0] ? results[0].devueltos : 0
      });
    }
  );
});

// ==================== DASHBOARD PARA BIBLIOTECARIO ====================
app.get('/dashboard-bibliotecario', (req, res) => {
  if (!req.session.user || req.session.user.rol !== 'bibliotecario') {
    return res.redirect('/login');
  }
  // Consulta para cards
  connection.query(
    `SELECT 
      (SELECT COUNT(*) FROM libros WHERE estado='Disponible') AS disponibles,
      (SELECT COUNT(*) FROM prestamos WHERE estado='Prestado') AS prestados,
      (SELECT COUNT(*) FROM prestamos WHERE estado='Devuelto') AS devueltos`,
    (err, resumen) => {
      // Consulta para tabla de préstamos activos
      connection.query(
        `SELECT p.id, l.name AS libro, u.nombre AS usuario, p.fecha_prestamo, p.fecha_devolucion, p.estado
         FROM prestamos p
         JOIN libros l ON p.libro_id = l.id
         JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.estado = 'Prestado'`,
        (err2, prestamosActivos) => {
          res.render('dashboard_bibliotecario', {
            title: 'Panel Bibliotecario',
            user: req.session.user,
            totalDisponibles: resumen[0].disponibles,
            totalPrestados: resumen[0].prestados,
            totalDevueltos: resumen[0].devueltos,
            prestamosActivos
          });
        }
      );
    }
  );
});

// ==================== DASHBOARD PARA USUARIO ====================
app.get('/dashboard-usuario', (req, res) => {
  if (!req.session.user || req.session.user.rol !== 'usuario') {
    return res.redirect('/login');
  }
  // Consulta libros, autores y categorías
  connection.query(
    `SELECT l.*, a.nombre AS autor, e.name AS editorial, c.nombre AS categoria,
      (SELECT COUNT(*) FROM prestamos p WHERE p.libro_id = l.id AND p.estado = 'Prestado') AS prestado
     FROM libros l
     LEFT JOIN autores a ON l.author_id = a.id
     LEFT JOIN editoriales e ON l.editorial_id = e.id
     LEFT JOIN categorias c ON l.categoria_id = c.id`,
    (err, libros) => {
      connection.query('SELECT * FROM autores', (err2, autores) => {
        connection.query('SELECT * FROM categorias', (err3, categorias) => {
          // Consulta préstamos activos del usuario
          connection.query(
            `SELECT p.id, l.name AS libro, p.fecha_prestamo, p.fecha_devolucion
             FROM prestamos p
             JOIN libros l ON p.libro_id = l.id
             WHERE p.usuario_id = ? AND p.estado = 'Prestado'`,
            [req.session.user.id],
            (err4, prestamosActivos) => {
              res.render('dashboard_usuario', {
                title: 'Panel Usuario',
                user: req.session.user,
                libros,
                autores,
                categorias,
                prestamosActivos, // <-- ahora sí se pasa a la vista
                messages: req.flash()
              });
            }
          );
        });
      });
    }
  );
});

app.use('/users', usersRouter);
app.use('/books', booksRouter);
// app.use('/books/editoriales', editorialesRouter); // ELIMINA o comenta esta línea


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;