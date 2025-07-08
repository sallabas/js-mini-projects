CREATE TABLE Users (
                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                       name TEXT NOT NULL,
                       surname TEXT NOT NULL,
                       email TEXT UNIQUE NOT NULL,
                       age INTEGER NOT NULL
);

CREATE TABLE Events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        date DATE NOT NULL,
                        location TEXT NOT NULL
);

CREATE TABLE Participants (
                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                              event_id INTEGER NOT NULL,
                              user_id INTEGER NOT NULL,
                              participation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                              FOREIGN KEY (event_id) REFERENCES Events(id),
                              FOREIGN KEY (user_id) REFERENCES Users(id)
);


INSERT INTO Users (name, surname, email, age) VALUES
                                    ('Kemal', 'Sallabas', 'kemal@example.com', 25),
                                    ('Yigit', 'Sallabas', 'yigit@example.com', 32);

INSERT INTO Events (name, date, location) VALUES
                                              ('Event X', '2024-06-10', 'Warsaw'),
                                              ('Event Y', '2024-06-15', 'Istanbul');




DELETE FROM Events WHERE name IS NULL OR date IS NULL OR location IS NULL;

DROP TABLE IF EXISTS Events;
DROP TABLE IF EXISTS Users;

SELECT Users.name AS userName, Participants.participation_date AS participationDate
FROM Participants
         JOIN Users ON Participants.user_id = Users.id
WHERE Participants.event_id = 1; -- Örnek bir Event ID

