from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle

def get_template_styles(styles, is_arabic=False, template="modern"):
    alignment = TA_RIGHT if is_arabic else TA_LEFT
    font_name = "Amiri" if is_arabic else "Helvetica"

    base_style = ParagraphStyle(
        name="BaseStyle",
        fontName=font_name,
        fontSize=12,
        leading=14,
        alignment=alignment,
    )

    title_style = ParagraphStyle(
        name="TitleStyle",
        parent=base_style,
        fontSize=16,
        leading=18,
        spaceAfter=10,
    )

    subtitle_style = ParagraphStyle(
        name="SubtitleStyle",
        parent=base_style,
        fontSize=14,
        leading=16,
        spaceAfter=8,
    )

    body_style = ParagraphStyle(
        name="BodyStyle",
        parent=base_style,
        fontSize=12,
        leading=14,
    )

    return {
        "base": base_style,
        "title": title_style,
        "subtitle": subtitle_style,
        "body": body_style,
    }
