var express = require('express');
var router = express.Router();
var dbConn = require('../lib/db');

router.get('/', function (req, res, next) {
    let page = parseInt(req.query.page) || 1;
    let limit = 10;
    let offset = (page - 1) * limit;

    dbConn.query('SELECT * FROM books ORDER BY id desc LIMIT ?, ?', [offset, limit], function (err, rows) {
        if (err) {
            req.flash('error', 'Hubo un error al obtener los libros');
            res.render('books', { data: '' });
        } else {
            dbConn.query('SELECT COUNT(*) AS total FROM books', function (err, countResult) {
                if (err) {
                    req.flash('error', 'Hubo un error al contar los libros');
                    res.render('books', { data: '' });
                } else {
                    const totalBooks = countResult[0].total;
                    const totalPages = Math.ceil(totalBooks / limit);
                    res.render('books', {
                        data: rows,
                        pagination: {
                            currentPage: page,
                            totalPages: totalPages,
                            previous: page > 1 ? page - 1 : null,
                            next: page < totalPages ? page + 1 : null
                        },
                        messages: {
                            success: req.flash('success'),
                            error: req.flash('danger')
                        }
                    });
                }
            });
        }
    });
});

router.get('/search', function (req, res, next) {
    let query = req.query.query;
    let page = parseInt(req.query.page) || 1;
    let limit = 10;
    let offset = (page - 1) * limit;

    if (!query) {
        dbConn.query('SELECT * FROM books ORDER BY id desc LIMIT ?, ?', [offset, limit], function (err, rows) {
            if (err) {
                req.flash('error', 'Hubo un error al obtener los libros');
                res.render('books', { data: '' });
            } else {
                dbConn.query('SELECT COUNT(*) AS total FROM books', function (err, countResult) {
                    if (err) {
                        req.flash('error', 'Hubo un error al contar los libros');
                        res.render('books', { data: '' });
                    } else {
                        const totalBooks = countResult[0].total;
                        const totalPages = Math.ceil(totalBooks / limit);
                        res.render('books', {
                            data: rows,
                            pagination: {
                                currentPage: page,
                                totalPages: totalPages,
                                previous: page > 1 ? page - 1 : null,
                                next: page < totalPages ? page + 1 : null
                            },
                            messages: {
                                success: req.flash('success'),
                                error: req.flash('error')
                            }
                        });
                    }
                });
            }
        });
    } else {
        dbConn.query('SELECT * FROM books WHERE name LIKE ? OR author LIKE ? ORDER BY id desc LIMIT ?, ?', ['%' + query + '%', '%' + query + '%', offset, limit], function (err, rows) {
            if (err) {
                req.flash('error', 'Hubo un error al realizar la búsqueda');
                res.render('books', { data: '' });
            } else {
                dbConn.query('SELECT COUNT(*) AS total FROM books WHERE name LIKE ? OR author LIKE ?', ['%' + query + '%', '%' + query + '%'], function (err, countResult) {
                    if (err) {
                        req.flash('error', 'Hubo un error al contar los resultados');
                        res.render('books', { data: '' });
                    } else {
                        const totalBooks = countResult[0].total;
                        const totalPages = Math.ceil(totalBooks / limit);
                        res.render('books', {
                            data: rows,
                            pagination: {
                                currentPage: page,
                                totalPages: totalPages,
                                previous: page > 1 ? page - 1 : null,
                                next: page < totalPages ? page + 1 : null
                            },
                            messages: {
                                success: req.flash('success'),
                                error: req.flash('error')
                            }
                        });
                    }
                });
            }
        });
    }
});

router.get('/add', function (req, res, next) {
    res.render('books/add', { name: '', author: '' });
});

router.post('/add', function (req, res, next) {
    let name = req.body.name;
    let author = req.body.author;
    let errors = false;

    if (name.length === 0 || author.length === 0) {
        errors = true;
        req.flash('error', "Por favor ingrese el nombre y autor");
        res.render('books/add', { name: name, author: author });
    }

    if (!errors) {
        var form_data = { name: name, author: author };
        dbConn.query('INSERT INTO books SET ?', form_data, function (err, result) {
            if (err) {
                req.flash('error', 'Hubo un error al agregar el libro');
                res.render('books/add', { name: form_data.name, author: form_data.author });
            } else {
                req.flash('success', 'Libro agregado con éxito');
                res.redirect('/books');
            }
        });
    }
});

router.get('/edit/(:id)', function (req, res, next) {
    let id = req.params.id;
    dbConn.query('SELECT * FROM books WHERE id = ' + id, function (err, rows, fields) {
        if (err) throw err;

        if (rows.length <= 0) {
            req.flash('error', 'No se encontró el libro con id = ' + id);
            res.redirect('/books');
        } else {
            res.render('books/edit', { title: 'Editar Libro', id: rows[0].id, name: rows[0].name, author: rows[0].author });
        }
    });
});

router.post('/update/:id', function (req, res, next) {
    let id = req.params.id;
    let name = req.body.name;
    let author = req.body.author;
    let errors = false;

    if (name.length === 0 || author.length === 0) {
        errors = true;
        req.flash('error', "Por favor ingrese el nombre y autor");
        res.render('books/edit', { id: req.params.id, name: name, author: author });
    }

    if (!errors) {
        var form_data = { name: name, author: author };
        dbConn.query('UPDATE books SET ? WHERE id = ' + id, form_data, function (err, result) {
            if (err) {
                req.flash('error', 'Hubo un error al actualizar el libro');
                res.render('books/edit', { id: req.params.id, name: form_data.name, author: form_data.author });
            } else {
                req.flash('success', 'Libro actualizado con éxito');
                res.redirect('/books');
            }
        });
    }
});

router.get('/delete/(:id)', function (req, res, next) {
    let id = req.params.id;
    dbConn.query('DELETE FROM books WHERE id = ' + id, function (err, result) {
        if (err) {
            req.flash('error', 'Hubo un error al eliminar el libro');
            res.redirect('/books');
        } else {
            req.flash('danger', 'Libro eliminado con éxito! ID = ' + id);
            res.redirect('/books');
        }
    });
});

module.exports = router;
