"""
Entry point for the Noise Pollution Monitoring Backend API.

This script runs the Flask application using the modular app factory.
"""

from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
