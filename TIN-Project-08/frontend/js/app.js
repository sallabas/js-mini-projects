let currentPage = 1;

async function fetchEvents() {
    try {
        const response = await fetch(`/events?page=${currentPage}&limit=10`);
        if (!response.ok) {
            throw new Error('Failed to fetch events.');
        }

        const data = await response.json();
        const events = data.events;

        const eventTableBody = document.getElementById('eventTableBody');
        eventTableBody.innerHTML = '';

        events.forEach(event => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${event.id}</td>
                <td>${event.name}</td>
                <td>${event.date}</td>
                <td>${event.location}</td>
                <td>
                    <button class="info-button" onclick="toggleEventInfo(${event.id})">Info</button>
                    <button class="sign-up-button" onclick="signUpForEvent(${event.id})">Sign Up</button>
                    <button class="edit-button" onclick="openEditEventForm(${event.id})">Edit</button>
                    <button class="delete-button" onclick="deleteEvent(${event.id})">Delete</button>
                </td>
            `;
            eventTableBody.appendChild(row);
        });

        document.getElementById('currentPage').innerText = currentPage;
        document.getElementById('prevPage').disabled = currentPage === 1;
        document.getElementById('nextPage').disabled = currentPage >= data.totalPages;

    } catch (error) {
        console.error('Error fetching events:', error);
        alert('Unexpected error');
    }
}

// !!! Possible issue
async function signUpForEvent(eventId) {
    try {
        const response = await fetch(`/sign-up/${eventId}`, { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            alert(result.message || 'You successfully signed up for the event');
            fetchEvents();
        } else {
            alert(result.message || 'Failed to sign up for the event');
        }
    } catch (error) {
        console.error('Error signing up for event:', error);
        alert('Unexpected error');
    }
}

// !!!!!! Possible issue
async function deleteEvent(eventId) {
    try {
        const response = await fetch(`/delete/${eventId}`, {
            method: 'POST',
            credentials: 'include',
            redirect: 'manual',
        });

        console.log('Response status:', response.status);

        if (response.status === 302) {
            console.log('Redirected to:', response.headers.get('Location'));
            showNotification('error', 'Redirected to login, please log in');
            return;
        }

        const result = await response.json();
        if (response.ok) {
            showNotification('success', result.message || 'Event deleted successfully');
        } else {
            showNotification('error', result.message || 'Failed to delete the event');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        showNotification('error', 'Unexpected error');
    }
}


// !!!!! Possible issue
function showNotification(type, message) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('Notification container can not be found');
        return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}



// !!!!! Possible issue - participant name
async function toggleEventInfo(eventId) {
    const eventRow = document.querySelector(`[data-event-id='${eventId}']`);
    if (!eventRow) {
        console.error(`Event with ID ${eventId} not found in the current page.`);
        return;
    }

    const nextRow = eventRow.nextElementSibling;

    if (nextRow && nextRow.classList.contains('info-row')) {
        nextRow.remove();
        return;
    }

    try {
        const response = await fetch(`/event-info/${eventId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch event info');
        }

        const participants = await response.json();

        const infoRow = document.createElement('tr');
        infoRow.classList.add('info-row');
        infoRow.innerHTML = `
            <td colspan="5">
                <strong>Participants:</strong>
                <ul>
                    ${participants.map(participant => `
                        <li>${participant.name} - ${participant.participationDate}</li>
                    `).join('')}
                </ul>
            </td>
        `;
        eventRow.insertAdjacentElement('afterend', infoRow);
    } catch (error) {
        console.error('Error fetching event info:', error);
    }
}

function openEditEventForm(eventId) {
    window.location.href = `/edit/${eventId}`;
}

document.addEventListener('DOMContentLoaded', fetchEvents);
