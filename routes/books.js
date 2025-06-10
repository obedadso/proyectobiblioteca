var express = require('express');
var router = express.Router();
var dbConn = require('../lib/db');

// ==================== CRUD LIBROS ====================

// ...código existente arriba...

// Mostrar todos los libros (listado principal y formulario) con paginado y búsqueda
router.get('/', function(req, res) {
    const librosPorPagina = 10;
    const paginaActual = parseInt(req.query.pagina) || 1;
    const offset = (paginaActual - 1) * librosPorPagina;
    const busqueda = req.query.busqueda ? req.query.busqueda.trim() : '';

    // Construir filtro de búsqueda
    let where = '';
    let params = [];

    if (busqueda) {
        where = `WHERE libros.name LIKE ? OR libros.isbn LIKE ? OR autores.nombre LIKE ?`;
        params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
    }

    // Contar total de libros (con filtro si hay búsqueda)
    const countSql = `
        SELECT COUNT(*) AS total
        FROM libros
        JOIN autores ON libros.author_id = autores.id
        ${where}
    `;
    dbConn.query(countSql, params, function(err, result) {
        const totalLibros = result ? result[0].total : 0;
        const totalPaginas = Math.ceil(totalLibros / librosPorPagina);

        // Consulta principal con paginado y filtro
        const sql = `
            SELECT libros.*, 
                   autores.nombre AS autor_nombre, 
                   editoriales.name AS editorial_nombre, 
                   categorias.nombre AS categoria_nombre
            FROM libros
            JOIN autores ON libros.author_id = autores.id
            JOIN editoriales ON libros.editorial_id = editoriales.id
            JOIN categorias ON libros.categoria_id = categorias.id
            ${where}
            LIMIT ? OFFSET ?
        `;
        dbConn.query(sql, [...params, librosPorPagina, offset], function(err, libros) {
            if (err) {
                req.flash('error', 'Hubo un error al obtener los libros');
                libros = [];
            }
            dbConn.query('SELECT * FROM autores', function(err2, autores) {
                if (err2) autores = [];
                dbConn.query('SELECT * FROM editoriales', function(err3, editoriales) {
                    if (err3) editoriales = [];
                    dbConn.query('SELECT * FROM categorias', function(err4, categorias) {
                        if (err4) categorias = [];
                        // Cambia la vista según el rol
                        let vista = 'books/libro';
                        if (req.session.user && req.session.user.rol === 'bibliotecario') {
                            vista = 'bibliotecario/libros';
                        }
                        res.render(vista, {
                            libros,
                            libro: null,
                            autores,
                            editoriales,
                            categorias,
                            paginaActual,
                            totalPaginas,
                            librosPorPagina,
                            busqueda,
                            success: req.flash('success'),
                            error: req.flash('error')
                        });
                    });
                });
            });
        });
    });
});

// ...código existente abajo...

// Mostrar formulario para agregar libro
router.get('/add', function(req, res) {
    dbConn.query('SELECT * FROM autores', function(err, autores) {
        if (err) autores = [];
        dbConn.query('SELECT * FROM editoriales', function(err2, editoriales) {
            if (err2) editoriales = [];
            dbConn.query('SELECT * FROM categorias', function(err3, categorias) {
                if (err3) categorias = [];
                res.render('books/libro', {
                    libro: null,
                    autores,
                    editoriales,
                    categorias,
                    success: req.flash('success'),
                    error: req.flash('error')
                });
            });
        });
    });
});

// Agregar libro
router.post('/add', function(req, res) {
    const { isbn, name, author, editorial, anio_publicacion, num_paginas, categoria } = req.body;
    dbConn.query(
        'INSERT INTO libros (isbn, name, author_id, editorial_id, anio_publicacion, num_paginas, categoria_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [isbn, name, author, editorial, anio_publicacion, num_paginas, categoria],
        function(err) {
            if (err) {
                req.flash('error', 'Hubo un error al agregar el libro');
            } else {
                req.flash('success', 'Libro agregado con éxito');
            }
            res.redirect('/books');
        }
    );
});

// Actualizar libro
router.post('/update/:id', function(req, res) {
    const { isbn, name, author, editorial, anio_publicacion, num_paginas, categoria } = req.body;
    dbConn.query(
        'UPDATE libros SET isbn = ?, name = ?, author_id = ?, editorial_id = ?, anio_publicacion = ?, num_paginas = ?, categoria_id = ? WHERE id = ?',
        [isbn, name, author, editorial, anio_publicacion, num_paginas, categoria, req.params.id],
        function(err) {
            if (err) {
                req.flash('error', 'Hubo un error al actualizar el libro');
            } else {
                req.flash('success', 'Libro actualizado con éxito');
            }
            res.redirect('/books');
        }
    );
});

// Mostrar formulario para editar libro
router.get('/edit/:id', function(req, res) {
    dbConn.query('SELECT * FROM libros WHERE id = ?', [req.params.id], function(err, libros) {
        if (err || libros.length === 0) {
            req.flash('error', 'Libro no encontrado');
            return res.redirect('/books');
        }
        dbConn.query('SELECT * FROM autores', function(err2, autores) {
            if (err2) autores = [];
            dbConn.query('SELECT * FROM editoriales', function(err3, editoriales) {
                if (err3) editoriales = [];
                dbConn.query('SELECT * FROM categorias', function(err4, categorias) {
                    if (err4) categorias = [];
                    res.render('books/libro', {
                        libro: libros[0],
                        autores,
                        editoriales,
                        categorias,
                        success: req.flash('success'),
                        error: req.flash('error')
                    });
                });
            });
        });
    });
});

// Eliminar libro
router.post('/delete/:id', function(req, res) {
    dbConn.query('DELETE FROM libros WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Error al eliminar el libro');
        } else {
            req.flash('success', 'Libro eliminado correctamente');
        }
        res.redirect('/books');
    });
});

// ==================== CRUD AUTORES ====================

router.get('/autores', function(req, res) {
    dbConn.query('SELECT * FROM autores', function(err, rows) {
        if (err) {
            req.flash('error', 'Hubo un error al obtener los autores');
            res.render('books/autores', { 
                autores: [],
                success: req.flash('success'),
                error: req.flash('error')
            });
        } else {
            res.render('books/autores', { 
                autores: rows,
                success: req.flash('success'),
                error: req.flash('error')
            });
        }
    });
});

router.post('/autores/add', function(req, res) {
    const { nombre, nacionalidad } = req.body;
    dbConn.query('INSERT INTO autores (nombre, nacionalidad) VALUES (?, ?)', [nombre, nacionalidad], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al agregar el autor');
        } else {
            req.flash('success', 'Autor agregado con éxito');
        }
        res.redirect('/books/autores');
    });
});

router.post('/autores/edit/:id', function(req, res) {
    const { nombre, nacionalidad } = req.body;
    dbConn.query('UPDATE autores SET nombre = ?, nacionalidad = ? WHERE id = ?', [nombre, nacionalidad, req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al actualizar el autor');
        } else {
            req.flash('success', 'Autor actualizado con éxito');
        }
        res.redirect('/books/autores');
    });
});

router.post('/autores/delete/:id', function(req, res) {
    dbConn.query('DELETE FROM autores WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al eliminar el autor');
        } else {
            req.flash('success', 'Autor eliminado con éxito');
        }
        res.redirect('/books/autores');
    });
});

// ==================== CRUD EDITORIALES ====================

router.get('/editoriales', function(req, res) {
    dbConn.query('SELECT * FROM editoriales', function(err, rows) {
        if (err) {
            req.flash('error', 'Hubo un error al obtener las editoriales');
            res.render('editoriales', { editorials: [] });
        } else {
            res.render('editoriales', { editorials: rows });
        }
    });
});

router.post('/editoriales/add', function(req, res) {
    const { name, status } = req.body;
    dbConn.query('INSERT INTO editoriales (name, status) VALUES (?, ?)', [name, status], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al agregar la editorial');
        } else {
            req.flash('success', 'Editorial agregada con éxito');
        }
        res.redirect('/books/editoriales');
    });
});

router.post('/editoriales/edit/:id', function(req, res) {
    const { name, status } = req.body;
    dbConn.query('UPDATE editoriales SET name = ?, status = ? WHERE id = ?', [name, status, req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al actualizar la editorial');
        } else {
            req.flash('success', 'Editorial actualizada con éxito');
        }
        res.redirect('/books/editoriales');
    });
});

router.post('/editoriales/delete/:id', function(req, res) {
    dbConn.query('DELETE FROM editoriales WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al eliminar la editorial');
        } else {
            req.flash('success', 'Editorial eliminada con éxito');
        }
        res.redirect('/books/editoriales');
    });
});

// ==================== CRUD CATEGORÍAS ====================

router.get('/categorias', function(req, res) {
    dbConn.query('SELECT * FROM categorias', function(err, rows) {
        if (err) {
            req.flash('error', 'Hubo un error al obtener las categorías');
            res.render('books/categoria', { 
                categorias: [],
                success: req.flash('success'),
                error: req.flash('error')
            });
        } else {
            res.render('books/categoria', { 
                categorias: rows,
                success: req.flash('success'),
                error: req.flash('error')
            });
        }
    });
});

router.post('/categorias/add', function(req, res) {
    const { nombre, estado } = req.body;
    dbConn.query('INSERT INTO categorias (nombre, estado) VALUES (?, ?)', [nombre, estado], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al agregar la categoría');
        } else {
            req.flash('success', 'Categoría agregada con éxito');
        }
        res.redirect('/books/categorias');
    });
});

router.post('/categorias/edit/:id', function(req, res) {
    const { nombre, estado } = req.body;
    dbConn.query('UPDATE categorias SET nombre = ?, estado = ? WHERE id = ?', [nombre, estado, req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al actualizar la categoría');
        } else {
            req.flash('success', 'Categoría actualizada con éxito');
        }
        res.redirect('/books/categorias');
    });
});

router.post('/categorias/delete/:id', function(req, res) {
    dbConn.query('DELETE FROM categorias WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al eliminar la categoría');
        } else {
            req.flash('success', 'Categoría eliminada con éxito');
        }
        res.redirect('/books/categorias');
    });
});

router.get('/libro', function(req, res) {
    res.redirect('/books');
});

// ==================== CRUD PRÉSTAMOS ====================

// Listar préstamos
router.get('/prestamos', function(req, res) {
    dbConn.query(
        `SELECT prestamos.*, 
                libros.name AS libro_nombre, 
                usuarios.nombre AS usuario_nombre 
         FROM prestamos 
         JOIN libros ON prestamos.libro_id = libros.id 
         JOIN usuarios ON prestamos.usuario_id = usuarios.id`,
        function(err, prestamos) {
            if (err) prestamos = [];
            dbConn.query('SELECT id, name FROM libros', function(err2, libros) {
                if (err2) libros = [];
                dbConn.query('SELECT id, nombre FROM usuarios', function(err3, usuarios) {
                    if (err3) usuarios = [];
                    res.render('books/prestamos', {
                        prestamos,
                        libros,
                        usuarios,
                        success: req.flash('success'),
                        error: req.flash('error')
                    });
                });
            });
        }
    );
});

// Agregar préstamo
router.post('/prestamos/add', function(req, res) {
    // Puedes dejar la verificación de sesión si quieres
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const { libro, usuario, fecha_prestamo, fecha_devolucion, estado } = req.body;
    dbConn.query(
        'INSERT INTO prestamos (libro_id, usuario_id, fecha_prestamo, fecha_devolucion, estado) VALUES (?, ?, ?, ?, ?)',
        [libro, usuario, fecha_prestamo, fecha_devolucion, estado],
        function(err) {
            if (err) {
                req.flash('error', 'Hubo un error al agregar el préstamo');
                return res.redirect('/books/prestamos');
            }
            // Cambia el estado del libro a "Prestado"
            dbConn.query(
                'UPDATE libros SET estado = ? WHERE id = ?',
                ['Prestado', libro],
                function(err2) {
                    if (err2) {
                        req.flash('error', 'El préstamo se registró pero no se pudo actualizar el estado del libro');
                    } else {
                        req.flash('success', 'Préstamo agregado con éxito');
                    }
                    res.redirect('/books/prestamos');
                }
            );
        }
    );
});
// Editar préstamo
router.post('/prestamos/edit/:id', function(req, res) {
    const { libro, usuario, fecha_prestamo, fecha_devolucion, estado } = req.body;
    dbConn.query(
        'UPDATE prestamos SET libro_id = ?, usuario_id = ?, fecha_prestamo = ?, fecha_devolucion = ?, estado = ? WHERE id = ?',
        [libro, usuario, fecha_prestamo, fecha_devolucion, estado, req.params.id],
        function(err) {
            if (err) {
                req.flash('error', 'Hubo un error al actualizar el préstamo');
            } else {
                req.flash('success', 'Préstamo actualizado con éxito');
            }
            res.redirect('/books/prestamos');
        }
    );
});

// Eliminar préstamo
router.post('/prestamos/delete/:id', function(req, res) {
    dbConn.query('DELETE FROM prestamos WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            req.flash('error', 'Hubo un error al eliminar el préstamo');
        } else {
            req.flash('success', 'Préstamo eliminado con éxito');
        }
        res.redirect('/books/prestamos');
    });
});

// ...código existente...

// Ruta para devolver un préstamo desde el dashboard del usuario
router.post('/prestamos/devolver/:id', function(req, res) {
    // Cambia el estado del préstamo a 'Devuelto'
    dbConn.query(
        'UPDATE prestamos SET estado = ? WHERE id = ?',
        ['Devuelto', req.params.id],
        function(err) {
            if (err) {
                req.flash('error', 'Error al devolver el libro');
                return res.redirect('/dashboard-usuario');
            }
            // Busca el libro asociado a este préstamo
            dbConn.query(
                'SELECT libro_id FROM prestamos WHERE id = ?',
                [req.params.id],
                function(err2, result) {
                    if (!err2 && result.length > 0) {
                        // Cambia el estado del libro a 'Disponible'
                        dbConn.query(
                            'UPDATE libros SET estado = ? WHERE id = ?',
                            ['Disponible', result[0].libro_id],
                            function() {
                                req.flash('success', 'Libro devuelto con éxito');
                                res.redirect('/dashboard-usuario');
                            }
                        );
                    } else {
                        res.redirect('/dashboard-usuario');
                    }
                }
            );
        }
    );
});

module.exports = router;