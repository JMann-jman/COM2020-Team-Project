"""
Routes for data exports in the Noise Pollution Monitoring API.

This file defines blueprints for exporting data as CSV or PDF.
"""

from flask import Blueprint, request, send_file, jsonify
import ast
import io
from datetime import datetime, timedelta
import pandas as pd
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
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


@export_bp.route('/export/stakeholder-report', methods=['GET'])
def export_stakeholder_report():
    """
    Export a formatted stakeholder PDF report.

    Query Parameters:
        zone_id (str, optional): Filter all sections to a single zone.
        sections (str): Comma-separated list of sections to include.
                        Options: summary, hotspots, reports, plans (default: all).

    Returns:
        PDF file download.
    """
    if not check_role('planner'):
        return jsonify({'error': 'Unauthorized'}), 403

    zone_id = request.args.get('zone_id')
    sections_param = request.args.get('sections', 'summary,hotspots,reports,plans')
    sections = set(s.strip() for s in sections_param.split(','))

    zones_df = data_loader.zones.copy()
    zone_name = 'All Zones'
    if zone_id:
        match = zones_df[zones_df['zone_id'] == zone_id]
        zone_name = match['name'].iloc[0] if len(match) > 0 else zone_id

    def filter_zone(df):
        if zone_id and 'zone_id' in df.columns:
            return df[df['zone_id'] == zone_id].copy()
        return df.copy()

    obs = filter_zone(data_loader.observations)
    reports = filter_zone(data_loader.reports)
    hotspots_df = filter_zone(data_loader.hotspots)
    plans_df = filter_zone(data_loader.plans)
    interventions_df = data_loader.interventions.copy()
    zone_map = dict(zip(zones_df['zone_id'], zones_df['name']))
    int_names = dict(zip(interventions_df['intervention_id'], interventions_df['type']))

    # --- Styles ---
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('ReportTitle', parent=styles['Title'],
                                 fontSize=22, leading=28, spaceAfter=6)
    h1_style = ParagraphStyle('H1', parent=styles['Heading1'],
                              fontSize=14, leading=18, spaceAfter=6, spaceBefore=18,
                              textColor=colors.HexColor('#1a1a1a'))
    h2_style = ParagraphStyle('H2', parent=styles['Heading2'],
                              fontSize=11, leading=14, spaceAfter=4, spaceBefore=10)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14)
    muted_style = ParagraphStyle('Muted', parent=styles['Normal'],
                                 fontSize=8, leading=11, textColor=colors.HexColor('#666666'))

    def make_table(headers, rows, col_widths=None):
        data = [[Paragraph(str(h), ParagraphStyle('TH', parent=styles['Normal'],
                           fontSize=9, textColor=colors.white, fontName='Helvetica-Bold'))
                 for h in headers]]
        for row in rows:
            data.append([Paragraph(str(cell), ParagraphStyle('TD', parent=styles['Normal'],
                                   fontSize=9, leading=12))
                         for cell in row])
        t = Table(data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c2c2c')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7f7f7')]),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#dddddd')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        return t

    story = []

    # --- Title block ---
    story.append(Spacer(1, 0.4 * inch))
    story.append(Paragraph('Neighbourhood Noise', title_style))
    story.append(Paragraph('Stakeholder Report', title_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(f'<b>Zone:</b> {zone_name}', body_style))
    story.append(Paragraph(f'<b>Generated:</b> {datetime.utcnow().strftime("%d %B %Y")}', body_style))
    story.append(Spacer(1, 0.05 * inch))
    story.append(Paragraph('Neighbourhood Noise Explorer — Prototype v0.1', muted_style))
    story.append(Spacer(1, 0.3 * inch))
    story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#2c2c2c')))
    story.append(Spacer(1, 0.2 * inch))

    # --- Executive Summary & Noise Landscape ---
    if 'summary' in sections:
        story.append(Paragraph('Executive Summary', h1_style))

        total_obs = len(obs)
        avg_db = obs['value_db'].dropna().mean() if total_obs > 0 else 0
        status_counts = reports['status'].value_counts().to_dict() if len(reports) > 0 else {}
        active_plans = len(plans_df[plans_df['status'].isin(['planned', 'in_progress'])]) if len(plans_df) > 0 else 0

        summary_rows = [
            ['Total observations', str(total_obs)],
            ['Average noise level', f'{avg_db:.1f} dB'],
            ['Total incident reports', str(len(reports))],
            ['Valid reports', str(status_counts.get('valid', 0))],
            ['Pending / under review', str(status_counts.get('pending', 0) + status_counts.get('under_review', 0))],
            ['Active intervention plans', str(active_plans)],
        ]
        story.append(make_table(['Metric', 'Value'], summary_rows,
                                col_widths=[3.5 * inch, 3.5 * inch]))
        story.append(Spacer(1, 0.25 * inch))

        if total_obs > 0:
            story.append(Paragraph('Top Noise Categories', h2_style))
            cat_counts = obs['category_tag'].value_counts().head(5)
            cat_rows = [[cat, str(count)] for cat, count in cat_counts.items()]
            story.append(make_table(['Category', 'Observations'], cat_rows,
                                    col_widths=[3.5 * inch, 3.5 * inch]))
            story.append(Spacer(1, 0.25 * inch))

        if not zone_id and len(data_loader.observations) > 0:
            story.append(Paragraph('Average Noise Level by Zone', h2_style))
            zone_avg = (data_loader.observations
                        .groupby('zone_id')['value_db']
                        .mean()
                        .sort_values(ascending=False)
                        .head(8))
            zone_rows = [[zone_map.get(zid, zid), f'{db:.1f} dB'] for zid, db in zone_avg.items()]
            story.append(make_table(['Zone', 'Avg Noise Level'], zone_rows,
                                    col_widths=[3.5 * inch, 3.5 * inch]))
            story.append(Spacer(1, 0.25 * inch))

    # --- Hotspots ---
    if 'hotspots' in sections and len(hotspots_df) > 0:
        story.append(Paragraph('Top Noise Hotspots', h1_style))
        story.append(Paragraph(
            'Severity score = average noise (dB) + validated report count × 0.8.',
            muted_style))
        story.append(Spacer(1, 0.1 * inch))
        top_hs = hotspots_df.sort_values('severity_score', ascending=False).head(5)
        hs_rows = [
            [
                zone_map.get(row['zone_id'], row['zone_id']),
                str(row.get('time_window', '—')),
                f"{float(row['severity_score']):.1f}",
                str(row.get('rationale', '—'))[:70],
            ]
            for _, row in top_hs.iterrows()
        ]
        story.append(make_table(
            ['Zone', 'Time Window', 'Severity', 'Rationale'],
            hs_rows,
            col_widths=[1.4 * inch, 1.2 * inch, 0.9 * inch, 3.5 * inch]
        ))
        story.append(Spacer(1, 0.25 * inch))

    # --- Incident Reports ---
    if 'reports' in sections and len(reports) > 0:
        story.append(Paragraph('Incident Reports', h1_style))

        story.append(Paragraph('Status Breakdown', h2_style))
        status_rows = [[s, str(c)] for s, c in reports['status'].value_counts().items()]
        story.append(make_table(['Status', 'Count'], status_rows,
                                col_widths=[3.5 * inch, 3.5 * inch]))
        story.append(Spacer(1, 0.2 * inch))

        valid_reports = reports[reports['status'] == 'valid'].head(10)
        if len(valid_reports) > 0:
            story.append(Paragraph('Recent Valid Reports', h2_style))
            rep_rows = [
                [
                    row['report_id'],
                    zone_map.get(row['zone_id'], row['zone_id']),
                    str(row.get('category', '—')),
                    str(row.get('time_window', '—')),
                ]
                for _, row in valid_reports.iterrows()
            ]
            story.append(make_table(
                ['Report ID', 'Zone', 'Category', 'Time Window'],
                rep_rows,
                col_widths=[1.5 * inch, 1.5 * inch, 2 * inch, 2 * inch]
            ))
        story.append(Spacer(1, 0.25 * inch))

    # --- Intervention Plans ---
    if 'plans' in sections and len(plans_df) > 0:
        story.append(Paragraph('Intervention Plans', h1_style))
        plan_rows = []
        for _, row in plans_df.iterrows():
            try:
                int_ids = ast.literal_eval(str(row['interventions_selected']))
                int_label = ', '.join(int_names.get(i, i) for i in int_ids[:3])
                if len(int_ids) > 3:
                    int_label += f' +{len(int_ids) - 3} more'
            except Exception:
                int_label = str(row['interventions_selected'])[:50]
            plan_rows.append([
                row['plan_id'],
                zone_map.get(row['zone_id'], row['zone_id']),
                int_label,
                f"£{int(row['budget']):,}",
                f"{float(row['expected_impact']):.1f} dB",
                str(row['status']).replace('_', ' '),
            ])
        story.append(make_table(
            ['Plan ID', 'Zone', 'Interventions', 'Budget', 'Impact', 'Status'],
            plan_rows,
            col_widths=[0.7 * inch, 0.8 * inch, 2.6 * inch, 0.8 * inch, 0.8 * inch, 1.0 * inch]
        ))
        story.append(Spacer(1, 0.25 * inch))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch, leftMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title='Neighbourhood Noise Stakeholder Report',
    )
    doc.build(story)
    buffer.seek(0)
    filename = f'stakeholder-report-{datetime.utcnow().strftime("%Y%m%d")}.pdf'
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name=filename)
