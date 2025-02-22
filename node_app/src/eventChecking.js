
export function composeNewEventsEmail(data) {
	if (!data || data.length === 0) return null;

	const lastResults = loadLastResults();

	const lastMaxId = lastResults ? lastResults[0].id : 0;
	const newEvents = data.filter(event => event.id > lastMaxId);

	return {
		subject: `New 42 Events Detected (${newEvents.length} new ${newEvents.length == 1 ? 'event' : 'events'})`,
		body: `New events detected:\n\n${formatEvents(newEvents)}`
	};
}

function formatEvents(events) {
	// Format event details for email body
	const details = events.map(event => {
	// Convert UTC timestamps to more readable format
	const beginTime = new Date(event.begin_at || '');
	const endTime = new Date(event.end_at || '');
	
	// Helper function to format the date/time
	const formatDateTime = (date) => {
		return date.toLocaleString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'UTC'
		});
	};

	// Format just the time (HH:MM)
	const formatTime = (date) => {
		return date.toLocaleString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'UTC'
		});
	};

	// Format the event details using template literal
	return `
📅 ${event.name || 'N/A'}
--------------------------------------------------
📍 Location: ${event.location || 'N/A'}
🏷️ Type: ${(event.kind || 'N/A').replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
⏰ When: ${formatDateTime(beginTime)} - ${formatTime(endTime)} UTC
👥 Max Participants: ${event.max_people === null ? 'Unlimited' : event.max_people}
🔗 Link: https://profile.intra.42.fr/events/${event.id || ''}

📝 Description:
${event.description || 'N/A'}
`;
	});

	return details.join('\n===========================================\n');
}

function saveResults(data) {
	// Save the last result to a file
	fs.writeFileSync('last_result.json', JSON.stringify(data, null, 2));
}

function loadLastResults() {
	// Load the last result from a file
	try {
		const data = fs.readFileSync('last_result.json', 'utf8');
		return JSON.parse(data);
	} catch (error) {
		logger.error('Error loading last results:', error.message);
		return null;
	}
}