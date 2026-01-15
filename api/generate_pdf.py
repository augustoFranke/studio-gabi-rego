"""
Vercel Python Serverless Function for PDF Generation
This endpoint generates training plan PDFs using ReportLab
"""

import json
import io
import os
from http.server import BaseHTTPRequestHandler
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Table, TableStyle
from reportlab.lib.utils import simpleSplit

# A4 Dimensions
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_LEFT = 1.5 * cm
MARGIN_RIGHT = 1.5 * cm
MARGIN_TOP = 1.5 * cm
USEABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Font settings (use built-in fonts for Vercel compatibility)
FONT_REGULAR = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'

# Extra rows for notes/observations
EXTRA_ROWS = 3


def get_logo_path():
    """Get the logo path - works in both local and Vercel environments"""
    # In Vercel, static files are in the /var/task directory
    possible_paths = [
        os.path.join(os.getcwd(), 'public', 'logo-black.png'),
        '/var/task/public/logo-black.png',
        os.path.join(os.path.dirname(__file__), '..', 'public', 'logo-black.png'),
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return path

    return None


def generate_pdf(aluno: str, date: str, sessions: list, observacoes: str = None) -> bytes:
    """
    Generate a training plan PDF and return as bytes.

    Args:
        aluno: Student name
        date: Date string (e.g., "01/2026")
        sessions: List of session dicts with 'name' and 'exercises' keys
                  Each exercise has 'name', 'sets', 'reps' keys
        observacoes: Optional observations text

    Returns:
        PDF file as bytes
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"Ficha de Treino - {aluno}")

    cursor_y = PAGE_HEIGHT - MARGIN_TOP

    # 1. DRAW LOGO
    logo_w = 5 * cm
    logo_h = 5 * cm
    logo_path = get_logo_path()

    if logo_path:
        try:
            c.drawImage(logo_path, MARGIN_LEFT, cursor_y - logo_h,
                        width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)
        except Exception as e:
            print(f"Warning: Could not load logo: {e}")

    # 2. DRAW HEADER TEXT (ALUNO / DATA)
    text_x_start = MARGIN_LEFT + logo_w + 1 * cm

    # Aluno Line
    c.setFont(FONT_BOLD, 20)
    c.drawString(text_x_start, cursor_y - 2 * cm, "ALUNO:")
    c.setFont(FONT_REGULAR, 20)
    c.drawString(text_x_start + 2.5 * cm, cursor_y - 2 * cm, aluno)
    c.line(text_x_start + 2.3 * cm, cursor_y - 2.2 * cm, PAGE_WIDTH - MARGIN_RIGHT, cursor_y - 2.2 * cm)

    # Data Line
    c.setFont(FONT_BOLD, 20)
    c.drawString(text_x_start, cursor_y - 3.5 * cm, "DATA:")
    c.setFont(FONT_REGULAR, 20)
    c.drawString(text_x_start + 2.5 * cm, cursor_y - 3.5 * cm, date)
    c.line(text_x_start + 2.3 * cm, cursor_y - 3.7 * cm, PAGE_WIDTH - MARGIN_RIGHT, cursor_y - 3.7 * cm)

    # Move cursor below the header section
    cursor_y -= (logo_h + 1 * cm)

    def draw_workout_table(canvas_obj, title: str, start_y: float, exercises: list) -> float:
        """
        Draw a workout table with exercises and extra rows for notes.
        """
        canvas_obj.setFont(FONT_BOLD, 18)
        canvas_obj.drawString(MARGIN_LEFT, start_y, title)

        table_top = start_y - 0.6 * cm

        # Table Structure: Exercicio, Series, Repeticoes, (empty for notes)
        data = [['EXERCICIOS', 'SERIES', 'REPETICOES', '']]

        # Add exercises
        for ex in exercises:
            data.append([
                ex.get('name', ''),
                str(ex.get('sets', '')),
                str(ex.get('reps', '')),
                ''
            ])

        # Add extra empty rows for notes
        for _ in range(EXTRA_ROWS):
            data.append(['', '', '', ''])

        # Column widths
        col_widths = [
            USEABLE_WIDTH * 0.45,
            USEABLE_WIDTH * 0.15,
            USEABLE_WIDTH * 0.15,
            USEABLE_WIDTH * 0.25
        ]

        t = Table(data, colWidths=col_widths, rowHeights=0.7 * cm)
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), FONT_REGULAR),
            ('FONTSIZE', (0, 0), (-1, -1), 16),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (2, -1), 'CENTER'),  # Center series and repeticoes columns
        ]))

        w, h = t.wrap(USEABLE_WIDTH, PAGE_HEIGHT)

        # Check if table fits on current page
        if table_top - h < MARGIN_TOP + 2 * cm:
            canvas_obj.showPage()
            canvas_obj.setFont(FONT_BOLD, 18)
            table_top = PAGE_HEIGHT - MARGIN_TOP
            canvas_obj.drawString(MARGIN_LEFT, table_top, title)
            table_top -= 0.6 * cm

        t.drawOn(canvas_obj, MARGIN_LEFT, table_top - h)
        return table_top - h - 1 * cm

    # Draw each session as a table
    for session in sessions:
        session_name = session.get('name', 'A')
        exercises = session.get('exercises', [])

        # Only draw if there are exercises
        if exercises:
            cursor_y = draw_workout_table(
                c,
                f"TREINO {session_name}",
                cursor_y,
                exercises
            )

    # Draw observations at the bottom if present
    if observacoes and observacoes.strip():
        # Check if we need a new page for observations
        if cursor_y < MARGIN_TOP + 4 * cm:
            c.showPage()
            cursor_y = PAGE_HEIGHT - MARGIN_TOP

        # Draw "OBSERVACOES:" label and text on the same line
        c.setFont(FONT_REGULAR, 18)
        label = "OBSERVACOES: "
        label_width = c.stringWidth(label, FONT_REGULAR, 18)
        c.drawString(MARGIN_LEFT, cursor_y, label)

        # Calculate remaining width for text on first line
        remaining_width = USEABLE_WIDTH - label_width

        # Split observations into lines
        obs_lines = simpleSplit(observacoes.strip(), FONT_REGULAR, 18, remaining_width)

        # Draw first line next to the label
        if obs_lines:
            c.drawString(MARGIN_LEFT + label_width, cursor_y, obs_lines[0])

        # Draw remaining lines below
        line_y = cursor_y - 0.7 * cm
        for line in obs_lines[1:]:
            full_lines = simpleSplit(line, FONT_REGULAR, 18, USEABLE_WIDTH)
            for full_line in full_lines:
                c.drawString(MARGIN_LEFT, line_y, full_line)
                line_y -= 0.7 * cm

    c.save()
    buffer.seek(0)
    return buffer.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            # Extract data
            aluno = data.get('aluno', '')
            date = data.get('date', '')
            observacoes = data.get('observacoes', '')
            sessions = data.get('sessions', [])

            # Validate
            if not aluno or not date or not sessions:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Dados incompletos. Preencha aluno, data e pelo menos um treino.'
                }).encode())
                return

            # Filter out empty sessions
            valid_sessions = [s for s in sessions if s.get('exercises') and len(s['exercises']) > 0]

            if not valid_sessions:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Adicione pelo menos um exercicio em um treino.'
                }).encode())
                return

            # Generate PDF
            pdf_bytes = generate_pdf(aluno, date, valid_sessions, observacoes)

            # Generate filename
            safe_aluno = ''.join(c if c.isalnum() else '-' for c in aluno)[:30]
            safe_date = date.replace('/', '-')
            filename = f"Treino-{safe_aluno}-{safe_date}.pdf"

            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(pdf_bytes)))
            self.end_headers()
            self.wfile.write(pdf_bytes)

        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Invalid JSON'}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': f'Erro ao gerar PDF: {str(e)}'}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
