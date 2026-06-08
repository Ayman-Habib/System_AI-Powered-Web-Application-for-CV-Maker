import os
from reportlab.platypus import Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER


# === Helper: Ensure required styles exist ===
def ensure_styles(styles, is_arabic=False):
    """Ensure all essential text styles exist"""
    align = TA_RIGHT if is_arabic else TA_LEFT
    if "Heading1" not in styles:
        styles["Heading1"] = ParagraphStyle(
            "Heading1",
            fontName="ArabicFont" if is_arabic else "Helvetica-Bold",
            fontSize=18,
            leading=22,
            alignment=align,
            spaceAfter=10,
        )
    if "Heading2" not in styles:
        styles["Heading2"] = ParagraphStyle(
            "Heading2",
            fontName="ArabicFont" if is_arabic else "Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0B3954"),
            alignment=align,
            spaceBefore=10,
            spaceAfter=6,
        )
    if "Normal" not in styles:
        styles["Normal"] = ParagraphStyle(
            "Normal",
            fontName="ArabicFont" if is_arabic else "Helvetica",
            fontSize=11,
            leading=15,
            alignment=align,
        )
    return styles


# === Helper: Add Photo if available ===
def add_photo_to_story(story, personal_info):
    """Add circular user photo if available"""
    photo_path = personal_info.get("photo_path") or personal_info.get("photo")
    if photo_path and os.path.exists(photo_path.replace("/static/", "static/")):
        try:
            img = Image(photo_path.replace("/static/", "static/"))
            img.drawHeight = 1.2 * inch
            img.drawWidth = 1.2 * inch
            story.append(img)
            story.append(Spacer(1, 0.2 * inch))
        except Exception as e:
            print(f"[WARN] Could not load photo: {e}")


# === Section builders ===
def add_section(story, title, content_list, styles, is_arabic):
    """Generic section renderer"""
    if not content_list:
        return
    story.append(Paragraph(title, styles["Heading2"]))
    for item in content_list:
        if isinstance(item, dict):
            for k, v in item.items():
                if v:
                    story.append(Paragraph(f"<b>{k.capitalize()}:</b> {v}", styles["Normal"]))
        elif isinstance(item, str):
            story.append(Paragraph(item, styles["Normal"]))
        story.append(Spacer(1, 0.08 * inch))


# === Modern Template ===
def build_modern_design(story, personal_info, experiences, education, skills, extra, styles, is_arabic, language):
    styles = ensure_styles(styles, is_arabic)
    align = TA_RIGHT if is_arabic else TA_LEFT

    # Header
    add_photo_to_story(story, personal_info)
    name = personal_info.get("name", "")
    job_title = personal_info.get("job_title", "")
    summary = personal_info.get("summary", "")

    story.append(Paragraph(f"<b>{name}</b>", styles["Heading1"]))
    story.append(Paragraph(job_title, styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    if summary:
        story.append(Paragraph(summary, styles["Normal"]))
        story.append(Spacer(1, 0.2 * inch))

    # Sections
    add_section(story, "Experience" if language == "en" else "الخبرات", experiences, styles, is_arabic)
    add_section(story, "Education" if language == "en" else "التعليم", education, styles, is_arabic)
    if skills:
        story.append(Paragraph("Skills" if language == "en" else "المهارات", styles["Heading2"]))
        story.append(Paragraph(skills, styles["Normal"]))
        story.append(Spacer(1, 0.15 * inch))
    add_section(story, "Extra" if language == "en" else "إضافات", extra, styles, is_arabic)


def draw_modern_design(canvas, doc):
    canvas.setFillColorRGB(0.1, 0.3, 0.5)
    canvas.rect(0, doc.height + doc.topMargin + 20, doc.width + 2 * doc.leftMargin, 25, fill=True, stroke=0)


# === Professional Template ===
def build_professional_design(story, personal_info, experiences, education, skills, extra, styles, is_arabic, language):
    styles = ensure_styles(styles, is_arabic)

    add_photo_to_story(story, personal_info)
    name = personal_info.get("name", "")
    job_title = personal_info.get("job_title", "")
    email = personal_info.get("email", "")
    phone = personal_info.get("phone", "")
    location = personal_info.get("location", "")
    summary = personal_info.get("summary", "")

    # Header block
    story.append(Paragraph(f"<b>{name}</b>", styles["Heading1"]))
    story.append(Paragraph(job_title, styles["Heading2"]))
    if any([email, phone, location]):
        info = " | ".join(filter(None, [email, phone, location]))
        story.append(Paragraph(info, styles["Normal"]))
    story.append(Spacer(1, 0.15 * inch))
    if summary:
        story.append(Paragraph(summary, styles["Normal"]))
        story.append(Spacer(1, 0.25 * inch))

    # Sections
    add_section(story, "Work Experience" if language == "en" else "الخبرة العملية", experiences, styles, is_arabic)
    add_section(story, "Education" if language == "en" else "التعليم", education, styles, is_arabic)
    if skills:
        story.append(Paragraph("Key Skills" if language == "en" else "المهارات الأساسية", styles["Heading2"]))
        story.append(Paragraph(skills, styles["Normal"]))
        story.append(Spacer(1, 0.15 * inch))
    add_section(story, "Extra Information" if language == "en" else "معلومات إضافية", extra, styles, is_arabic)


def draw_professional_design(canvas, doc):
    canvas.setFillColorRGB(0.15, 0.2, 0.25)
    canvas.rect(0, 0, doc.width + 2 * doc.leftMargin, 40, fill=True, stroke=0)


# === Classic Template ===
def build_classic_design(story, personal_info, experiences, education, skills, extra, styles, is_arabic, language):
    styles = ensure_styles(styles, is_arabic)

    name = personal_info.get("name", "")
    job_title = personal_info.get("job_title", "")
    summary = personal_info.get("summary", "")

    story.append(Paragraph(f"<b>{name}</b>", styles["Heading1"]))
    if job_title:
        story.append(Paragraph(job_title, styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    if summary:
        story.append(Paragraph(summary, styles["Normal"]))
        story.append(Spacer(1, 0.2 * inch))

    add_section(story, "Experience" if language == "en" else "الخبرات", experiences, styles, is_arabic)
    add_section(story, "Education" if language == "en" else "التعليم", education, styles, is_arabic)
    if skills:
        story.append(Paragraph("Skills" if language == "en" else "المهارات", styles["Heading2"]))
        story.append(Paragraph(skills, styles["Normal"]))
        story.append(Spacer(1, 0.15 * inch))
    add_section(story, "Extra" if language == "en" else "إضافات", extra, styles, is_arabic)


def draw_classic_design(canvas, doc):
    canvas.setFillColorRGB(0.6, 0.6, 0.6)
    canvas.rect(0, doc.height + doc.topMargin + 10, doc.width + 2 * doc.leftMargin, 15, fill=True, stroke=0)
