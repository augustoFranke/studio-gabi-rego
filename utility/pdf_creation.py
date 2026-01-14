#!/usr/bin/env python3
"""
PDF Generator for Gabi Studio Training Plans

Usage:
    python pdf_creation.py --output output.pdf --data '{"aluno": "Maria", "date": "01/2026", "sessions": [...]}'
    
Or via stdin:
    echo '{"aluno": "Maria", ...}' | python pdf_creation.py --output output.pdf
"""

import json
import sys
import argparse
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Get script directory for logo path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGO_FILENAME = os.path.join(PROJECT_ROOT, "public", "logo-black.png")

# Register custom font
FREESTYLE_FONT_PATH = "/Library/Fonts/FreeStyle Script.ttf"
try:
    pdfmetrics.registerFont(TTFont('FreeStyleScript', FREESTYLE_FONT_PATH))
    FONT_REGULAR = 'FreeStyleScript'
    FONT_BOLD = 'FreeStyleScript'  # Script fonts don't have bold variant
except Exception as e:
    print(f"Warning: Could not load FreeStyle Script font: {e}", file=sys.stderr)
    FONT_REGULAR = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'

# A4 Dimensions
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_LEFT = 1.5 * cm
MARGIN_RIGHT = 1.5 * cm
MARGIN_TOP = 1.5 * cm
USEABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

# Extra rows for notes/observations
EXTRA_ROWS = 3


def generate_pdf(output_path: str, aluno: str, date: str, sessions: list, observacoes: str = None):
    """
    Generate a training plan PDF.

    Args:
        output_path: Path to save the PDF
        aluno: Student name
        date: Date string (e.g., "01/2026")
        sessions: List of session dicts with 'name' and 'exercises' keys
                  Each exercise has 'name', 'sets', 'reps' keys
        observacoes: Optional observations text
    """
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle(f"Ficha de Treino - {aluno}")
    
    cursor_y = PAGE_HEIGHT - MARGIN_TOP

    # 1. DRAW LOGO
    logo_w = 5 * cm
    logo_h = 5 * cm
    try:
        c.drawImage(LOGO_FILENAME, MARGIN_LEFT, cursor_y - logo_h, 
                    width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)
    except Exception as e:
        print(f"Warning: Could not load logo from {LOGO_FILENAME}: {e}", file=sys.stderr)

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
        
        Args:
            canvas_obj: The canvas object
            title: Table title (e.g., "TREINO A")
            start_y: Y position to start drawing
            exercises: List of exercise dicts with 'name', 'sets', 'reps'
            
        Returns:
            New Y position after drawing the table
        """
        canvas_obj.setFont(FONT_BOLD, 18)
        canvas_obj.drawString(MARGIN_LEFT, start_y, title)
        
        table_top = start_y - 0.6 * cm
        
        # Table Structure: Exercício, Séries, Repetições, (empty for notes)
        data = [['EXERCÍCIOS', 'SÉRIES', 'REPETIÇÕES', '']]
        
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
            ('ALIGN', (1, 0), (2, -1), 'CENTER'),  # Center séries and repetições columns
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
        
        # Only draw if there are exercises or it's explicitly included
        if exercises:
            cursor_y = draw_workout_table(
                c, 
                f"TREINO {session_name}", 
                cursor_y, 
                exercises
            )

    # Draw observations at the bottom if present
    if observacoes and observacoes.strip():
        from reportlab.lib.utils import simpleSplit
        
        # Check if we need a new page for observations
        if cursor_y < MARGIN_TOP + 4 * cm:
            c.showPage()
            cursor_y = PAGE_HEIGHT - MARGIN_TOP
        
        # Draw "OBSERVAÇÕES:" label and text on the same line
        c.setFont(FONT_REGULAR, 18)
        label = "OBSERVAÇÕES: "
        label_width = c.stringWidth(label, FONT_REGULAR, 18)
        c.drawString(MARGIN_LEFT, cursor_y, label)
        
        # Calculate remaining width for text on first line
        remaining_width = USEABLE_WIDTH - label_width
        
        # Split observations into lines
        obs_lines = simpleSplit(observacoes.strip(), FONT_REGULAR, 18, remaining_width)
        
        # Draw first line next to the label
        if obs_lines:
            c.drawString(MARGIN_LEFT + label_width, cursor_y, obs_lines[0])
        
        # Draw remaining lines below, aligned with the text (not the label)
        line_y = cursor_y - 0.7 * cm
        for line in obs_lines[1:]:
            # Re-split for full width lines
            full_lines = simpleSplit(line, FONT_REGULAR, 18, USEABLE_WIDTH)
            for full_line in full_lines:
                c.drawString(MARGIN_LEFT, line_y, full_line)
                line_y -= 0.7 * cm

    c.save()
    return output_path


def generate_blank_template(output_path: str = "ficha_treino_vazia.pdf"):
    """Generate a blank template PDF (for reference/printing)."""
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle("Ficha de Treino")
    
    cursor_y = PAGE_HEIGHT - MARGIN_TOP

    # Logo
    logo_w = 5 * cm
    logo_h = 5 * cm
    try:
        c.drawImage(LOGO_FILENAME, MARGIN_LEFT, cursor_y - logo_h, 
                    width=logo_w, height=logo_h, mask='auto', preserveAspectRatio=True)
    except:
        print(f"Warning: {LOGO_FILENAME} not found. Skipping image.")

    # Header
    c.setFont(FONT_BOLD, 20)
    text_x_start = MARGIN_LEFT + logo_w + 1 * cm
    
    c.drawString(text_x_start, cursor_y - 2 * cm, "ALUNO:")
    c.line(text_x_start + 2.3 * cm, cursor_y - 2.2 * cm, PAGE_WIDTH - MARGIN_RIGHT, cursor_y - 2.2 * cm)
    
    c.drawString(text_x_start, cursor_y - 3.5 * cm, "DATA:")
    c.line(text_x_start + 2.3 * cm, cursor_y - 3.7 * cm, PAGE_WIDTH - MARGIN_RIGHT, cursor_y - 3.7 * cm)

    cursor_y -= (logo_h + 1 * cm)

    def draw_blank_table(canvas_obj, title, start_y, rows=10):
        canvas_obj.setFont(FONT_BOLD, 18)
        canvas_obj.drawString(MARGIN_LEFT, start_y, title)
        
        table_top = start_y - 0.6 * cm
        
        data = [['EXERCÍCIOS', 'SÉRIES', 'REPETIÇÕES', '']]
        for _ in range(rows):
            data.append(['', '', '', ''])

        col_widths = [USEABLE_WIDTH * 0.45, USEABLE_WIDTH * 0.15, USEABLE_WIDTH * 0.15, USEABLE_WIDTH * 0.25]
        
        t = Table(data, colWidths=col_widths, rowHeights=0.7 * cm)
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), FONT_REGULAR),
            ('FONTSIZE', (0, 0), (-1, -1), 16),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (2, 0), 'CENTER'),
        ]))
        
        w, h = t.wrap(USEABLE_WIDTH, PAGE_HEIGHT)
        t.drawOn(canvas_obj, MARGIN_LEFT, table_top - h)
        return table_top - h - 1 * cm
    
    cursor_y = draw_blank_table(c, "TREINO A", cursor_y, rows=10)
    cursor_y = draw_blank_table(c, "TREINO B", cursor_y, rows=10)

    c.save()
    print(f"Successfully created {output_path}")


def main():
    parser = argparse.ArgumentParser(description='Generate training plan PDF')
    parser.add_argument('--output', '-o', required=True, help='Output PDF path')
    parser.add_argument('--data', '-d', help='JSON data string')
    parser.add_argument('--blank', action='store_true', help='Generate blank template')
    
    args = parser.parse_args()
    
    if args.blank:
        generate_blank_template(args.output)
        return
    
    # Get data from argument or stdin
    if args.data:
        data_str = args.data
    else:
        data_str = sys.stdin.read()
    
    try:
        data = json.loads(data_str)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    aluno = data.get('aluno', '')
    date = data.get('date', '')
    observacoes = data.get('observacoes', '')
    sessions = data.get('sessions', [])

    generate_pdf(args.output, aluno, date, sessions, observacoes)
    print(f"Successfully created {args.output}")


if __name__ == "__main__":
    main()
