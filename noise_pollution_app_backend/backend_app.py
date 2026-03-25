"""
Entry point for the Noise Pollution Monitoring Backend API.

This script runs the Flask application using the modular app factory.
"""

import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() in {'1', 'true', 'yes', 'on'}
    # Prefer cloud-assigned PORT (e.g., Render), with local fallback.
    port = int(os.getenv('PORT', os.getenv('BACKEND_PORT', '5001')))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
