"""PDF generation utilities using ReportLab."""
import io
import base64
import qrcode
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas


NAVY = colors.HexColor("#1E3A8A")
ROYAL = colors.HexColor("#1D4ED8")
SKY = colors.HexColor("#38BDF8")
DARK = colors.HexColor("#0F1A2E")
LIGHT_GREY = colors.HexColor("#94A3B8")


def _logo_image(logo_base64: str, width=2.5 * cm, height=2.5 * cm):
    if not logo_base64:
        return None
    try:
        if "," in logo_base64:
            logo_base64 = logo_base64.split(",", 1)[1]
        img_bytes = base64.b64decode(logo_base64)
        return Image(io.BytesIO(img_bytes), width=width, height=height)
    except Exception:
        return None


def _qr_image(data: str, size=3 * cm):
    qr = qrcode.QRCode(box_size=6, border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=size, height=size)


def generate_weekly_report_pdf(report: dict, leader: dict, settings: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                            leftMargin=2 * cm, rightMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=20,
                                 textColor=NAVY, alignment=TA_CENTER, spaceAfter=10)
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=13,
                                  textColor=ROYAL, spaceAfter=6)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, leading=15)

    story = []
    # Header
    logo = _logo_image(settings.get("school_logo_base64")) if settings.get("weekly_report_pdf_logo") else None
    if logo:
        story.append(logo)
    story.append(Paragraph(settings.get("school_name", "School"), title_style))
    story.append(Paragraph("Weekly Leadership Report", header_style))
    story.append(Spacer(1, 8))

    # Leader info
    info = [
        ["Leader Name:", leader.get("name", "")],
        ["Leader ID:", leader.get("leader_id", "")],
        ["Position:", leader.get("position", "-")],
        ["Week:", f"{report.get('week_start')} to {report.get('week_end')}"],
    ]
    t = Table(info, colWidths=[4 * cm, 10 * cm])
    t.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 11),
        ('TEXTCOLOR', (0, 0), (0, -1), NAVY),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    # Duty summary
    story.append(Paragraph("Duty Summary", header_style))
    summary = [
        ["Total Duties Assigned", str(report.get("total_duties_assigned", 0))],
        ["Total Duties Attended", str(report.get("total_duties_attended", 0))],
        ["Total Duties Missed", str(report.get("total_duties_missed", 0))],
        ["Self Evaluation", f"{report.get('self_evaluation', 0)} / 5"],
    ]
    st = Table(summary, colWidths=[7 * cm, 7 * cm])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, LIGHT_GREY),
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(st)
    story.append(Spacer(1, 15))

    for label, key in [("Challenges Faced", "challenges"), ("Suggestions", "suggestions"), ("Remarks", "remarks")]:
        story.append(Paragraph(label, header_style))
        story.append(Paragraph(report.get(key) or "-", body_style))
        story.append(Spacer(1, 10))

    story.append(Spacer(1, 30))
    # Signatures
    sig = [
        [f"Principal: {settings.get('principal_name', '')}", f"Coordinator: {settings.get('leadership_coordinator', '')}"],
    ]
    sig_t = Table(sig, colWidths=[8 * cm, 8 * cm])
    sig_t.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), NAVY),
    ]))
    story.append(sig_t)

    doc.build(story)
    return buf.getvalue()


def generate_id_card_pdf(leader: dict, settings: dict) -> bytes:
    buf = io.BytesIO()
    # ID card size ~8.5cm x 5.5cm approximately, using landscape smaller page
    from reportlab.lib.pagesizes import landscape
    page_size = (9 * cm, 5.6 * cm)
    c = canvas.Canvas(buf, pagesize=page_size)
    w, h = page_size

    # Background
    c.setFillColor(NAVY)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    # Accent bar
    c.setFillColor(SKY)
    c.rect(0, h - 1 * cm, w, 1 * cm, fill=1, stroke=0)

    # School name
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.3 * cm, h - 0.65 * cm, settings.get("school_name", "School")[:30])

    # Leader Name
    c.setFont("Helvetica-Bold", 12)
    c.drawString(0.3 * cm, h - 2 * cm, leader.get("name", "")[:24])
    c.setFont("Helvetica", 9)
    c.drawString(0.3 * cm, h - 2.5 * cm, f"ID: {leader.get('leader_id', '')}")
    c.drawString(0.3 * cm, h - 3 * cm, f"Position: {leader.get('position', '-')[:24]}")
    c.drawString(0.3 * cm, h - 3.5 * cm, f"Dept: {leader.get('department', '-')[:24]}")

    # QR
    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(leader.get("qr_token", leader.get("leader_id", "")))
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(qr_buf), w - 2.7 * cm, 0.4 * cm, width=2.3 * cm, height=2.3 * cm)

    # Footer strip
    c.setFillColor(SKY)
    c.rect(0, 0, w, 0.3 * cm, fill=1, stroke=0)

    c.showPage()
    c.save()
    return buf.getvalue()


def generate_certificate_pdf(cert_type: str, leader: dict, settings: dict,
                             description: str = "", date_str: str = "") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                            topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                            leftMargin=2 * cm, rightMargin=2 * cm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle('Title', parent=styles['Title'], fontSize=32,
                           textColor=NAVY, alignment=TA_CENTER, spaceAfter=15)
    subtitle = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=16,
                              textColor=ROYAL, alignment=TA_CENTER, spaceAfter=20)
    name_style = ParagraphStyle('Name', parent=styles['Title'], fontSize=28,
                                textColor=SKY, alignment=TA_CENTER, spaceAfter=15)
    body = ParagraphStyle('Body', parent=styles['Normal'], fontSize=13,
                          alignment=TA_CENTER, leading=18, spaceAfter=12)

    story = []
    logo = _logo_image(settings.get("school_logo_base64"), width=2.5 * cm, height=2.5 * cm)
    if logo:
        story.append(logo)
    story.append(Paragraph(settings.get("school_name", "School"), title))
    story.append(Paragraph("Certificate of Achievement", subtitle))
    story.append(Spacer(1, 15))
    story.append(Paragraph("This certificate is proudly presented to", body))
    story.append(Paragraph(leader.get("name", ""), name_style))
    story.append(Paragraph(f"Leader ID: {leader.get('leader_id', '')}", body))
    story.append(Paragraph(f"<b>{cert_type}</b>", subtitle))
    if description:
        story.append(Paragraph(description, body))
    story.append(Paragraph(f"Date: {date_str}", body))
    story.append(Spacer(1, 40))

    sig = [[
        f"____________________<br/>{settings.get('principal_name', 'Principal')}<br/>Principal",
        f"____________________<br/>{settings.get('leadership_coordinator', 'Coordinator')}<br/>Leadership Coordinator",
    ]]
    sig_style = ParagraphStyle('Sig', parent=styles['Normal'], fontSize=11,
                               alignment=TA_CENTER, textColor=NAVY)
    sig_data = [[Paragraph(cell, sig_style) for cell in sig[0]]]
    sig_t = Table(sig_data, colWidths=[10 * cm, 10 * cm])
    story.append(sig_t)

    doc.build(story)
    return buf.getvalue()


def generate_id_card_sheet_pdf(leaders: list, settings: dict) -> bytes:
    """A4 sheet with multiple ID cards for printing/cutting."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1 * cm, bottomMargin=1 * cm,
                            leftMargin=1 * cm, rightMargin=1 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('T', parent=styles['Title'], fontSize=14,
                                 textColor=NAVY, alignment=TA_CENTER)
    story = [Paragraph(f"{settings.get('school_name', 'School')} - Leader ID Cards", title_style), Spacer(1, 10)]

    # Build cells: 2 columns x N rows, each cell has an ID card mini-table
    def make_card(leader):
        qr = qrcode.QRCode(box_size=3, border=1)
        qr.add_data(leader.get("qr_token", leader.get("leader_id", "")))
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        qr_buf = io.BytesIO()
        img.save(qr_buf, format="PNG")
        qr_buf.seek(0)
        qr_img = Image(qr_buf, width=2 * cm, height=2 * cm)
        body_style = ParagraphStyle('B', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.black)
        title_s = ParagraphStyle('Ti', parent=styles['Normal'], fontSize=9, textColor=colors.black, fontName='Helvetica-Bold')
        info = Table([
            [Paragraph(f"<b>{settings.get('school_name', 'School')[:28]}</b>", body_style)],
            [Paragraph(leader.get("name", "")[:24], title_s)],
            [Paragraph(f"ID: {leader.get('leader_id', '')}", body_style)],
            [Paragraph(f"Pos: {leader.get('position', '-')[:24]}", body_style)],
        ], colWidths=[5.5 * cm])
        info.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 2), ('RIGHTPADDING', (0, 0), (-1, -1), 2)]))
        card = Table([[info, qr_img]], colWidths=[5.5 * cm, 2.2 * cm], rowHeights=[2.6 * cm])
        card.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
            ('BOX', (0, 0), (-1, -1), 0.75, NAVY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        return card

    rows = []
    row = []
    for i, l in enumerate(leaders):
        row.append(make_card(l))
        if len(row) == 2:
            rows.append(row); row = []
    if row:
        row.append("")
        rows.append(row)

    if rows:
        grid = Table(rows, colWidths=[8.5 * cm, 8.5 * cm], rowHeights=[3 * cm] * len(rows))
        grid.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(grid)
    else:
        story.append(Paragraph("No leaders found.", styles['Normal']))

    doc.build(story)
    return buf.getvalue()
