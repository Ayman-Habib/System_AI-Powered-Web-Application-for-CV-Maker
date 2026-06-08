from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT


def get_template_styles(base_styles, is_arabic=False, template="modern"):
    """
    Define paragraph and heading styles for all templates.
    Adjusts automatically for Arabic (RTL) or English (LTR).
    """
    alignment = TA_RIGHT if is_arabic else TA_LEFT
    font = "ArabicFont" if is_arabic else "Helvetica"

    styles = {
        "Heading1": ParagraphStyle(
            "Heading1",
            parent=base_styles["Normal"],
            fontName=font,
            fontSize=18,
            leading=22,
            alignment=alignment,
            spaceAfter=10,
        ),
        "Heading2": ParagraphStyle(
            "Heading2",
            parent=base_styles["Normal"],
            fontName=font,
            fontSize=14,
            leading=18,
            alignment=alignment,
            spaceAfter=8,
        ),
        "BodyText": ParagraphStyle(
            "BodyText",
            parent=base_styles["Normal"],
            fontName=font,
            fontSize=11,
            leading=15,
            alignment=alignment,
            spaceAfter=6,
        ),
    }

    return styles
