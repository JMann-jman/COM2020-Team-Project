"""
Routes for data exports in the Noise Pollution Monitoring API.

This module defines blueprints for exporting data as CSV or PDF.
"""

from flask import Blueprint, request, send_file, jsonify
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from ..auth import check_role
from ..data_loader import observations, reports

export_bp = Blueprint('export', __name__)

@export_bp.route('/export/csv', methods=['GET'])
def export_csv():
    """
    Export data as CSV.

    Query Parameters:
        type (str): Type of data to export ('observations' or 'reports', default: 'observations').

    Returns:
        CSV file download.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    data_type = request.args.get('type', 'observations')
    if data_type == 'observations':
        data = observations
    elif data_type == 'reports':
        data = reports
    else:
        return jsonify({'error': 'Invalid type'}), 400
    csv_data = data.to_csv(index=False)
    return send_file(io.BytesIO(csv_data.encode()), mimetype='text/csv', as_attachment=True, download_name=f'{data_type}.csv')

@export_bp.route('/export/pdf', methods=['GET'])
def export_pdf():
    """
    Export data as PDF.

    Query Parameters:
        type (str): Type of data to export ('observations' or 'reports', default: 'observations').

    Returns:
        PDF file download.
    """
    if not check_role('community'):
        return jsonify({'error': 'Unauthorized'}), 403
    data_type = request.args.get('type', 'observations')
    if data_type == 'observations':
        data = observations.head(10)
    elif data_type == 'reports':
        data = reports.head(10)
    else:
        return jsonify({'error': 'Invalid type'}), 400

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    p.drawString(100, 750, f'{data_type.capitalize()} Export')
    y = 720
    for index, row in data.iterrows():
        p.drawString(100, y, str(row.to_dict()))
        y -= 20
        if y < 50:
            p.showPage()
            y = 750
    p.save()
    buffer.seek(0)
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name=f'{data_type}.pdf')
