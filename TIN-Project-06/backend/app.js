const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = 3000;

const db = new sqlite3.Database('database/events.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('SQLite database connected');
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(
    session({
        secret: 'secret-key',
        resave: false,
        saveUninitialized: false,
    })
);
app.use((req, res, next) => {
    res.locals.userName = req.session.userName || null;
    next();
});


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authorization Middleware
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }

    console.log('Unauthorized access attempt:', {
        url: req.originalUrl,
        method: req.method,
        userId: req.session.userId || null,
    });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'You must be logged in to perform this action' });
    }

    res.redirect('/login');
}


// Routes
app.get('/', (req, res) => {
    res.render('index');
});


// Fetch Events with Pagination
app.get('/events', (req, res) => {
    const limit = parseInt(req.query.limit) || 10; // Sayfa başına gösterilecek event sayısı
    const page = parseInt(req.query.page) || 1;    // Hangi sayfada olduğumuzu al
    const offset = (page - 1) * limit;             // Gösterilecek verilerin başlangıç noktası

    const sql = 'SELECT * FROM Events LIMIT ? OFFSET ?';
    db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
            console.error('Error fetching events:', err.message);
            res.status(500).json({ error: 'Failed to fetch events' });
        } else {
            // Toplam kayıt sayısını almak için başka bir sorgu
            db.get('SELECT COUNT(*) AS count FROM Events', [], (err, result) => {
                if (err) {
                    console.error('Error fetching count:', err.message);
                    res.status(500).json({ error: 'Failed to fetch event count' });
                } else {
                    res.json({
                        events: rows,
                        total: result.count,
                        page: page,
                        totalPages: Math.ceil(result.count / limit),
                    });
                }
            });
        }
    });
});



// Register
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
    const { name, surname, email, age } = req.body;

    // Validation
    if (!name || !surname || !email || !age) {
        return res.status(400).send('Please fill all fields.');
    }

    if (isNaN(age) || age <= 0) {
        return res.status(400).send('Age must be a valid positive number.');
    }

    // Insert User
    const sql = 'INSERT INTO Users (name, surname, email, age) VALUES (?, ?, ?, ?)';
    db.run(sql, [name, surname, email, age], function (err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).send('Email already exists.');
            }
            console.error('Error registering user:', err.message);
            return res.status(500).send('Internal server error.');
        }
        res.redirect('/');
    });
});



// Login
app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { name, email } = req.body;

    const sql = 'SELECT * FROM Users WHERE name = ? AND email = ?';
    db.get(sql, [name, email], (err, user) => {
        if (err) {
            console.error('Error during login:', err.message);
            return res.status(500).send('An error occurred.');
        }

        if (!user) {
            return res.status(400).send('Invalid name or email.');
        }

        req.session.userId = user.id;
        req.session.userName = user.name;

        console.log('Session initialized:', req.session); // Controlling Log
        res.redirect('/');
    });
});





// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err.message);
            return res.status(500).send('An error occurred.');
        }
        res.redirect('/');
    });
});



// Add Event (Authenticated Only)
app.get('/add', isAuthenticated, (req, res) => res.render('add'));

app.post('/add', isAuthenticated, (req, res) => {

    // Validation, null field check
    const { name, date, location } = req.body;
    if (!name || !date || !location) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validation, alphabetic location regex
    const alphabeticRegex = /^[A-Za-z\s]+$/;
    if (!alphabeticRegex.test(location)) {
        return res.status(400).json({ error: 'Location must contain only alphabetic characters and spaces' });
    }

    const sql = 'INSERT INTO Events (name, date, location) VALUES (?, ?, ?)';
    db.run(sql, [name, date, location], (err) => {
        if (err) {
            console.error('Error adding event:', err.message);
            return res.status(500).json({ error: 'Failed to add event' });
        }
        res.redirect('/');
    });
});



// Edit Event (Authenticated Only)
app.get('/edit/:id', isAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM Events WHERE id = ?';
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching event for edit:', err.message);
            res.redirect('/');
        } else {
            res.render('edit', { eventData: row });
        }
    });
});

app.post('/edit/:id', isAuthenticated, (req, res) => {
    const { name, date, location } = req.body;
    const sql = 'UPDATE Events SET name = ?, date = ?, location = ? WHERE id = ?';
    db.run(sql, [name, date, location, req.params.id], (err) => {
        if (err) {
            console.error('Error updating event:', err.message);
            res.redirect(`/edit/${req.params.id}`);
        } else {
            res.redirect('/');
        }
    });
});



// Delete Event (Authenticated Only)
app.post('/delete/:id', isAuthenticated, (req, res) => {
    const { id: eventId } = req.params;

    db.run('DELETE FROM Events WHERE id = ?', [eventId], function (err) {
        if (err) {
            console.error('Error deleting event:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to delete the event.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Event not found or already deleted.' });
        }

        res.status(200).json({ success: true, message: 'Event deleted successfully.' });
    });
});




// Event Info
app.get('/event-info/:id', (req, res) => {
    const eventId = req.params.id;

    const query = `
        SELECT Users.name AS userName, Participants.participation_date AS participationDate
        FROM Participants
                 JOIN Users ON Participants.user_id = Users.id
        WHERE Participants.event_id = ?`;
    db.all(query, [eventId], (err, rows) => {
        if (err) {
            console.error('Error fetching participants:', err);
            return res.status(500).send([]);
        }

        console.log('Fetched participants:', rows); // Log ekle
        res.json(rows);
    });
});



// Sign Up
app.post('/sign-up/:id', isAuthenticated, (req, res) => {
    const { id: eventId } = req.params;
    const userId = req.session.userId;

    // Kullanıcının zaten kayıtlı olup olmadığını kontrol et
    const checkQuery = 'SELECT * FROM Participants WHERE event_id = ? AND user_id = ?';
    db.get(checkQuery, [eventId, userId], (err, row) => {
        if (err) {
            console.error('Error checking participation:', err.message);
            return res.status(500).json({ success: false, message: 'An error occurred.' });
        }

        if (row) {
            // Kullanıcı zaten kayıtlı
            return res.status(400).json({ success: false, message: 'You are already signed up for this event.' });
        }

        // Kayıt ekle
        const insertQuery = 'INSERT INTO Participants (event_id, user_id) VALUES (?, ?)';
        db.run(insertQuery, [eventId, userId], function (err) {
            if (err) {
                console.error('Error signing up for event:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to sign up for the event.' });
            }
            res.status(200).json({ success: true, message: 'Successfully signed up for the event!' });
        });
    });
});




// Start the server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
