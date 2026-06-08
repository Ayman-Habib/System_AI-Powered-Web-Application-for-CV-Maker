import os
import base64
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Circle
from reportlab.graphics import renderPDF
from reportlab.lib import colors

from PIL import Image as PILImage

import arabic_reshaper
from bidi.algorithm import get_display

# === Template imports ===
from .templates import (
    build_modern_design,
    draw_modern_design,
    build_professional_design,
    draw_professional_design,
    build_classic_design,
    draw_classic_design,
)
from .template_styles import get_template_styles


#  FONT SETUP
def setup_fonts():
    """إعداد الخطوط للغة العربية والإنجليزية"""
    font_dir = os.path.join(os.path.dirname(__file__), "../fonts")
    arabic_font_path = os.path.join(font_dir, "Amiri-Regular.ttf")

    try:
        if os.path.exists(arabic_font_path):
            pdfmetrics.registerFont(TTFont("ArabicFont", arabic_font_path))
            print(" Arabic font loaded successfully:", arabic_font_path)
            return "ArabicFont"
        else:
            print(" Arabic font not found, falling back to Helvetica.")
            return "Helvetica"
    except Exception as e:
        print(f" Font registration error: {e}")
        return "Helvetica"


FONT_NAME = setup_fonts()


#  ARABIC TEXT HANDLING
def process_arabic_text(text):
    """إعادة تشكيل النص العربي ليظهر بشكل صحيح في PDF"""
    try:
        reshaped_text = arabic_reshaper.reshape(text)
        bidi_text = get_display(reshaped_text)
        return bidi_text
    except Exception:
        return text


#  STYLE CREATOR
def make_paragraph_style(is_arabic):
    """إنشاء نمط فقرة مناسب للغة"""
    return ParagraphStyle(
        'DefaultArabic' if is_arabic else 'DefaultEnglish',
        fontName=FONT_NAME,
        fontSize=12,
        leading=16,
        alignment=TA_RIGHT if is_arabic else TA_LEFT,
    )



#  PHOTO HANDLING
def process_photo(personal_info):
    """Handle both file path and base64 user photos"""
    photo_data = None

    # Base64 image from frontend
    if personal_info.get('photo_base64'):
        try:
            header, encoded = personal_info['photo_base64'].split(',', 1)
            photo_data = base64.b64decode(encoded)
        except Exception:
            pass

    # File path from static folder
    elif personal_info.get('photo_path'):
        path = personal_info['photo_path'].replace('/static/', 'static/')
        if os.path.exists(path):
            with open(path, 'rb') as f:
                photo_data = f.read()

    if not photo_data:
        return None

    # Convert to circular image
    try:
        img = PILImage.open(io.BytesIO(photo_data)).convert("RGBA")
        size = (150, 150)
        img = img.resize(size)
        mask = PILImage.new("L", size, 0)
        draw = PILImage.new("RGBA", size, (255, 255, 255, 0))
        circle = PILImage.new("L", size, 0)
        mask_draw = PILImage.new("L", size, 0)
        for x in range(size[0]):
            for y in range(size[1]):
                dx, dy = x - size[0] / 2, y - size[1] / 2
                if dx * dx + dy * dy <= (size[0] / 2) ** 2:
                    mask.putpixel((x, y), 255)
        img.putalpha(mask)

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf
    except Exception as e:
        print(f" Photo processing error: {e}")
        return None


#  PDF GENERATOR
def generate_pdf(cv_data, language='en', template='modern'):
    """إنشاء PDF مع دعم اللغة العربية والتصاميم المختلفة"""
    try:
        # === إعداد اسم الملف ومساره ===
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        name = cv_data.get('personal_info', {}).get('name', 'CV')
        safe_name = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).strip() or "CV"
        filename = f"cv_{safe_name}_{timestamp}.pdf"

        output_dir = os.path.join(os.path.dirname(__file__), "../generated_cvs")
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.abspath(os.path.join(output_dir, filename))

        # === تحديد اللغة ===
        is_arabic = (language == 'ar')

        # === إعداد المستند ===
        doc = SimpleDocTemplate(
            filepath,
            pagesize=A4,
            topMargin=0.7 * inch,
            bottomMargin=0.7 * inch,
            leftMargin=0.7 * inch,
            rightMargin=0.7 * inch
        )

        story = []
        styles = getSampleStyleSheet()
        template_styles = get_template_styles(styles, is_arabic, template)

        # === استخراج البيانات ===
        personal_info = cv_data.get('personal_info', {})
        experiences = cv_data.get('experience', [])
        education = cv_data.get('education', [])
        skills = cv_data.get('skills', '')
        extra = cv_data.get('extra', [])

        # === معالجة النصوص العربية ===
        if is_arabic:
            for section in [personal_info, *experiences, *education, *extra]:
                if isinstance(section, dict):
                    for k, v in section.items():
                        if isinstance(v, str):
                            section[k] = process_arabic_text(v)
            if isinstance(skills, str):
                skills = process_arabic_text(skills)

        # === إدراج الصورة الشخصية (اختياري) ===
        photo_buf = process_photo(personal_info)
        if photo_buf:
            img = Image(photo_buf, width=1.5 * inch, height=1.5 * inch)
            img.hAlign = 'CENTER'
            story.append(img)

        # === بناء التصميم حسب القالب ===
        if template == 'modern':
            build_modern_design(story, personal_info, experiences, education, skills, extra, template_styles, is_arabic, language)
            doc.build(story, onFirstPage=draw_modern_design)
        elif template == 'professional':
            build_professional_design(story, personal_info, experiences, education, skills, extra, template_styles, is_arabic, language)
            doc.build(story, onFirstPage=draw_professional_design)
        elif template == 'classic':
            build_classic_design(story, personal_info, experiences, education, skills, extra, template_styles, is_arabic, language)
            doc.build(story, onFirstPage=draw_classic_design)
        else:
            build_modern_design(story, personal_info, experiences, education, skills, extra, template_styles, is_arabic, language)
            doc.build(story, onFirstPage=draw_modern_design)

        print(f"PDF generated successfully: {filepath}")
        return filepath

    except Exception as e:
        import traceback
        print(f"Error generating PDF: {e}")
        print(traceback.format_exc())
        return None
