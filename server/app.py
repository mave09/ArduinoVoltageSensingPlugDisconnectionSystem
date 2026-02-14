from flask import Flask, jsonify, request
from flask_cors import CORS
from pywebpush import webpush, WebPushException
import json

app = Flask(__name__)
CORS(app)

# VAPID keys - generate your own at https://vapidkeys.com/
VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
VAPID_PRIVATE_KEY = "UUxI4O8-FbRouADVXc-hK3ltm227GGnvBN2oQGNcocU"

# Store toggle states
state = {
    "status": False,
    "function": True
}

# Store push subscriptions
subscriptions = []

def send_push_to_all(title, body):
    """Send push notification to all subscribed devices"""
    global subscriptions
    valid_subs = []
    
    print(f"Sending push to {len(subscriptions)} subscribers: {title} - {body}")
    
    for i, sub in enumerate(subscriptions):
        try:
            print(f"Sending to subscriber {i+1}...")
            webpush(
                subscription_info=sub,
                data=json.dumps({"title": title, "body": body}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={
                    "sub": "mailto:test@example.com"
                }
            )
            print(f"Push sent successfully to subscriber {i+1}")
            valid_subs.append(sub)
        except WebPushException as e:
            print(f"WebPush failed for subscriber {i+1}: {e}")
            if e.response:
                print(f"Response status: {e.response.status_code}")
                print(f"Response body: {e.response.text}")
            if e.response and e.response.status_code in [404, 410]:
                print("Subscription expired, removing...")
                continue
            valid_subs.append(sub)
        except Exception as e:
            print(f"Push error for subscriber {i+1}: {e}")
            valid_subs.append(sub)
    
    subscriptions = valid_subs
    print(f"Push complete. Valid subscriptions: {len(subscriptions)}")

@app.route('/')
def index():
    return jsonify({
        "status": "ok", 
        "message": "Toggle API Server",
        "subscribers": len(subscriptions)
    })

@app.route('/api/vapid-public-key', methods=['GET'])
def get_vapid_key():
    return jsonify({"publicKey": VAPID_PUBLIC_KEY})

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    sub = request.get_json()
    # Check if endpoint already exists
    existing = [s for s in subscriptions if s.get('endpoint') == sub.get('endpoint')]
    if not existing:
        subscriptions.append(sub)
        print(f"New subscription added. Total: {len(subscriptions)}")
        print(f"Endpoint: {sub.get('endpoint', 'unknown')[:50]}...")
    else:
        print("Subscription already exists")
    return jsonify({"success": True, "total": len(subscriptions)})

@app.route('/api/unsubscribe', methods=['POST'])
def unsubscribe():
    sub = request.get_json()
    endpoint = sub.get('endpoint')
    global subscriptions
    subscriptions = [s for s in subscriptions if s.get('endpoint') != endpoint]
    return jsonify({"success": True})

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(state)

@app.route('/api/toggle/<name>', methods=['POST'])
def toggle(name):
    if name in state:
        state[name] = not state[name]
        command = "ON" if state[name] else "OFF"
        label = "Status" if name == "status" else "Function"
        
        # Send push to all devices
        send_push_to_all(label, f"Turned {command}")
        
        return jsonify({"name": name, "value": state[name]})
    return jsonify({"error": "Invalid toggle"}), 400

@app.route('/api/set/<name>', methods=['POST'])
def set_state(name):
    if name in state:
        data = request.get_json()
        state[name] = data.get('value', state[name])
        return jsonify({"name": name, "value": state[name]})
    return jsonify({"error": "Invalid toggle"}), 400

# Test endpoint to manually trigger push
@app.route('/api/test-push', methods=['POST'])
def test_push():
    send_push_to_all("Test", "This is a test notification")
    return jsonify({"success": True, "sent_to": len(subscriptions)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
