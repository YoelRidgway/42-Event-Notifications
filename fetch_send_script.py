import requests
import smtplib
import json
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

# Email configuration
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")
SENDER_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
RECIPIENT_EMAILS = os.environ.get("RECIPIENT_EMAILS")

# 42 API configuration
TOKEN_URL = "https://api.intra.42.fr/oauth/token"
API_URL = "https://api.intra.42.fr/v2/campus/1/events/"
CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")
CHECK_INTERVAL = 10  # Check every 10 seconds

class TokenManager:
	def __init__(self):
		self.access_token = None
		self.expires_at = 0
		self.secret_valid_until = 0
	
	def get_valid_token(self):
		"""Get a valid access token, refreshing if necessary."""

		minute = 60
		hour = 3600
		day = 86400
		week = 604800

		current_time = time.time()
		
		expire_date = datetime.fromtimestamp(self.secret_valid_until)
		# Alert if secret is about to expire
		if not self.secret_valid_until:
			print(f"First time token generation")
		elif current_time > self.secret_valid_until:
			print(f"Secret has expired")
		# Alert if secret is about to expire in 1 week
		elif current_time + week > self.secret_valid_until:
			print(f"Secret will expire in 1 week")
			send_email("42 API Secret Expiry Alert", f"42 API secret will expire in 1 week ({expire_date})")
		# Alert if secret is about to expire in 1 day
		elif current_time + day > self.secret_valid_until:
			print(f"Secret will expire in 1 day")
			send_email("42 API Secret Expiry Alert", f"42 API secret will expire in 1 day ({expire_date})")
		# Alert if secret is about to expire in 1 hour
		elif current_time + hour > self.secret_valid_until:
			print(f"Secret will expire in 1 hour")
			send_email("42 API Secret Expiry Alert", f"42 API secret will expire in 1 hour ({expire_date})")

		# Refresh token if it's expired
		if current_time >= (self.expires_at):
			self.refresh_token()
		
		return self.access_token
	
	def refresh_token(self):
		"""Get a new access token from the 42 API."""
		data = {
			'grant_type': 'client_credentials',
			'client_id': CLIENT_ID,
			'client_secret': CLIENT_SECRET
		}
		
		try:
			response = requests.post(TOKEN_URL, data=data)
			response.raise_for_status()
			token_data = response.json()
			
			self.access_token = token_data['access_token']
			self.expires_at = time.time() + token_data['expires_in']
			self.secret_valid_until = token_data['secret_valid_until']
			
			print(f"Token refreshed successfully at {datetime.now()}")
		except Exception as e:
			print(f"Failed to refresh token: {str(e)}")
			raise

def send_email(subject, body):
	"""Send an email using Gmail SMTP."""
	for recipient_email in RECIPIENT_EMAILS.split(","):
		try:
			msg = MIMEMultipart()
			msg['From'] = SENDER_EMAIL
			msg['To'] = recipient_email
			msg['Subject'] = subject
			msg.attach(MIMEText(body, 'plain'))
			
			with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
				server.starttls()
				server.login(SENDER_EMAIL, SENDER_PASSWORD)
				server.send_message(msg)
			
			print(f"Email sent successfully at {datetime.now()}")
		except Exception as e:
			print(f"Failed to send email: {str(e)}")

def check_api(token_manager):
	"""Check 42 API for new events."""
	try:
		headers = {
			'Authorization': f'Bearer {token_manager.get_valid_token()}'
		}
		params = {
			'sort': '-id'
		}
		
		response = requests.get(API_URL, headers=headers, params=params)
		response.raise_for_status()
		return response.json()
	except Exception as e:
		print(f"API check failed: {str(e)}")
		return None

def load_last_result():
	"""Load the last known result from file."""
	try:
		with open('last_result.json', 'r') as f:
			return json.load(f)
	except FileNotFoundError:
		return None

def save_result(result):
	"""Save the current result to file."""
	with open('last_result.json', 'w') as f:
		json.dump(result, f)

def format_event_details(events):
	"""Format event details for email body."""
	details = []
	for event in events:
		# Convert UTC timestamps to more readable format
		begin_time = datetime.fromisoformat(event.get('begin_at', '').replace('Z', '+00:00'))
		end_time = datetime.fromisoformat(event.get('end_at', '').replace('Z', '+00:00'))
		
		# Format the event details
		details.append(f"""
📅 {event.get('name', 'N/A')}
--------------------------------------------------
📍 Location: {event.get('location', 'N/A')}
🏷️ Type: {event.get('kind', 'N/A').replace('_', ' ').title()}
⏰ When: {begin_time.strftime('%B %d, %Y %H:%M')} - {end_time.strftime('%H:%M')} UTC
👥 Max Participants: {'Unlimited' if event.get('max_people') is None else event.get('max_people')}
🔗 Link: https://profile.intra.42.fr/events/{event.get('id')}

📝 Description:
{event.get('description', 'N/A')}
""")
	return "\n===========================================\n".join(details)

def main():
	print(f"Starting 42 API monitor at {datetime.now()}")
	print("Monitoring for new events...")
	
	token_manager = TokenManager()
	
	while True:
		try:
			# Get current API result
			current_result = check_api(token_manager)
			
			if current_result is None:
				time.sleep(CHECK_INTERVAL)
				continue
			
			# Load last known result
			last_result = load_last_result()
			
			# Check for new events
			if last_result is None:
				# First run
				# subject = f"New 42 Events Detected ({len(current_result)} new events)"
				# body = f"New events detected at {datetime.now()}\n\nDetails:\n{format_event_details(current_result)}"
				# send_email(subject, body)
				save_result(current_result)
			elif current_result and len(current_result) > 0:
				# Compare the newest event ID
				if last_result[0]['id'] != current_result[0]['id']:
					# New events found
					new_events = [
						event for event in current_result 
						if event['id'] > last_result[0]['id']
					]
					
					# Save new result
					save_result(current_result)
					
					# Send notification
					subject = f"New 42 Events Detected ({len(new_events)} new events)"
					body = f"New events detected at {datetime.now()}\n\nDetails:\n{format_event_details(new_events)}"
					send_email(subject, body)
			
			# Wait before next check
			time.sleep(CHECK_INTERVAL)
			
		except Exception as e:
			print(f"Error in main loop: {str(e)}")
			time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
	main()