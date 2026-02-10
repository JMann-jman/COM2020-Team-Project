"""
Flask application factory for the Noise Pollution Monitoring API.

This module initializes the Flask app, loads data, and registers blueprints for different route groups.
"""

from flask import Flask
from .data_loader import load_data
from .routes.noise_routes import noise_bp
from .routes.report_routes import report_bp
from .routes.plan_routes import plan_bp
from .routes.export_routes import export_bp
from .routes.success_routes import success_bp

def create_app():
    """
    Create and configure the Flask application.

    Returns:
        Flask: The configured Flask app instance.
    """
    app = Flask(__name__)

    # Load data globally
    load_data()

    # Register blueprints
    app.register_blueprint(noise_bp, url_prefix='/api')
    app.register_blueprint(report_bp, url_prefix='/api')
    app.register_blueprint(plan_bp, url_prefix='/api')
    app.register_blueprint(export_bp, url_prefix='/api')
    app.register_blueprint(success_bp, url_prefix='/api')

    return app
