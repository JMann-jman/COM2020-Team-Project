"""
Routes for data exports in the Noise Pollution Monitoring API.

This file defines blueprints for exporting data as CSV or PDF.
"""

from flask import Blueprint, request, send_file, jsonify
import io
from datetime import timedelta
import pandas as pd
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from ..auth import check_role
from .. import data_loader

export_bp = Blueprint('export', __name__)


def _get_filtered_data(data_type):
    if data_type == 'observations':
        data = data_loader.observations.copy()
        zone_ids = request.args.getlist('zones')
        categories = request.args.getlist('categories')
        source = request.args.get('source', 'Both')
        time_window = request.args.get('time_window')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if zone_ids:
            data = data[data['zone_id'].isin(zone_ids)]
        if categories:
            data = data[data['category_tag'].isin(categories)]
        if source and source != 'Both':
            source_map = {'Sensor': 'sensor', 'Reports': 'report'}
            mapped_source = source_map.get(source, source.lower())
            data = data[data['source'] == mapped_source]

        timestamps = pd.to_datetime(data['timestamp'], utc=True, errors='coerce')
        if time_window:
            valid_timestamps = timestamps.dropna()
            if len(valid_timestamps) > 0:
                ref_time = valid_timestamps.max()
                if time_window == 'Last 24 hours':
                    start = ref_time - timedelta(hours=24)
                elif time_window == 'Last 7 days':
                    start = ref_time - timedelta(days=7)
                elif time_window == 'Last 4 weeks':
                    start = ref_time - timedelta(weeks=4)
                else:
                    start = ref_time - timedelta(days=7)
                data = data[timestamps >= start]
        elif start_date and end_date:
            data = data[(timestamps >= pd.to_datetime(start_date, utc=True)) & (timestamps <= pd.to_datetime(end_date, utc=True))]

        return data

    if data_type == 'reports':
        data = data_loader.reports.copy()
        status = request.args.get('status')
        if status:
            data = data[data['status'] == status]
        return data

    return None

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
    data = _get_filtered_data(data_type)
    if data is None:
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
    data = _get_filtered_data(data_type)
    if data is None:
        return jsonify({'error': 'Invalid type'}), 400
    data = data.head(30)

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
